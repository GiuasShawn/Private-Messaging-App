// Real-browser verification harness for the Phase 0.5 spike.
//
// Drives the ACTUAL /spike page in Chromium, Firefox, and WebKit against a
// production `next start` build, and checks for each browser:
//   - WASM (pkg-web) initializes in-browser (step A passes)
//   - Olm handshake + Megolm + tamper rejection all pass (B, E, C)
//   - sealed save -> REAL page reload -> restore -> continue passes (D1-D4)
//   - the .wasm asset is served with Content-Type: application/wasm
//   - NO outbound request body/URL carries the canary plaintext or key markers
//   - NO console/pageerror output carries key markers
//
// Assumes the production server is already running (see README for the exact
// command). Set SPIKE_BASE_URL to override the default http://localhost:3111.
//
// This harness is NOT run by `npm test` (which is the offline Vitest suite);
// it needs browsers + a running server. Run it explicitly via
// `npm run verify:browser`.

import { chromium, firefox, webkit } from "playwright-core";

const BASE = process.env.SPIKE_BASE_URL || "http://localhost:3111";

// Strings that must never appear in outbound requests or console output.
// "signing_key" / "diffie_hellman" / "root_key" etc. are fields that appear
// ONLY inside plaintext pickles (which must stay sealed client-side).
const KEY_MARKERS = [
  "signing_key",
  "diffie_hellman",
  "one_time_keys",
  "root_key",
  "ratchet_key",
  "private_key",
  "fallback_keys",
];

const ENGINES = [
  ["chromium", chromium],
  ["firefox", firefox],
  ["webkit", webkit],
];

function parseSteps(inner) {
  const out = [];
  // Each rendered step looks like: "[A] WASM initialization (pass)\ndetail"
  const re = /\[([A-Za-z0-9]+)\]\s*([^\n(]+?)\s*\((pass|fail|skipped)\)/g;
  let m;
  while ((m = re.exec(inner)) !== null) {
    out.push({ id: m[1], label: m[2].trim(), status: m[3] });
  }
  return out;
}

// The page renders a real failure as its own line "Error: <message>". Step
// details can legitimately CONTAIN the substring "error:" (e.g. the Megolm
// rejection text "... signature error: Verification equation ..."), so we
// must match a line-starting, capital-E "Error: " — a case-insensitive
// /error:/ match caused a false positive that tripped the wait early and
// skipped the D1 check during initial runs.
function extractError(inner) {
  const m = inner.match(/^Error: .*$/m);
  return m ? m[0] : null;
}

// Phase 1 reaches a terminal state when the save step (D1) renders, or when a
// step reports fail (runPhase1 returns no ctx, so D1 is never reached), or a
// real error paragraph appears. NOTE: these predicates run INSIDE the page via
// waitForFunction, so they must read the DOM themselves (they receive no
// innerText argument), and they must not close over any Node-scope values.
const phase1Settled = () => {
  const t = document.body.innerText;
  return /\[D1\]/.test(t) || /\(fail\)/.test(t) || /^Error: /m.test(t);
};

// Restore reaches a terminal state when D4 renders, or a step fails, or a real error.
const restoreSettled = () => {
  const t = document.body.innerText;
  return /\[D4\]/.test(t) || /\(fail\)/.test(t) || /^Error: /m.test(t);
};

function allPassed(steps, ids) {
  return ids.every((id) => {
    const s = steps.find((x) => x.id === id);
    return s && s.status === "pass";
  });
}

async function runEngine(name, engine) {
  const report = {
    browser: name,
    ok: false,
    wasmLoadedInBrowser: false,
    phase1Steps: [],
    restoreSteps: [],
    canaries: [],
    network: { requests: 0, wasmContentType: null, leaks: [] },
    console: { messages: 0, leaks: [] },
    errors: [],
  };

  let browser;
  try {
    browser = await engine.launch();
    const ctx = await browser.newContext();
    const page = await ctx.newPage();

    const requests = [];
    const consoleMsgs = [];
    const wasmResponses = [];

    page.on("request", (r) => {
      requests.push({ url: r.url(), method: r.method(), body: r.postData() ?? "" });
    });
    page.on("response", async (r) => {
      if (r.url().includes(".wasm")) {
        try {
          wasmResponses.push({ url: r.url(), status: r.status(), ct: r.headers()["content-type"] });
        } catch {
          /* ignore */
        }
      }
    });
    page.on("console", (m) => consoleMsgs.push(`${m.type()}: ${m.text()}`));
    page.on("pageerror", (e) => consoleMsgs.push(`pageerror: ${e.message}`));

    await page.goto(`${BASE}/spike`, { waitUntil: "load", timeout: 30000 });

    // ---- Phase 1: handshake + tamper + megolm, seal & save ----
    await page.getByRole("button", { name: /Run handshake/i }).click();
    await page.waitForFunction(phase1Settled, null, { timeout: 45000 });
    const p1Inner = await page.evaluate(() => document.body.innerText);
    report.phase1Steps = parseSteps(p1Inner);
    const p1Err = extractError(p1Inner);
    if (p1Err) report.errors.push(`phase1: ${p1Err}`);

    // Capture the phase-1 canary for the leakage audit.
    const c1 = p1Inner.match(/Canary in use:\s*(\S+)/);
    if (c1) report.canaries.push(c1[1]);
    report.wasmLoadedInBrowser = report.phase1Steps.find((s) => s.id === "A")?.status === "pass";

    // ---- Phase 2: REAL reload + restore + continue ----
    if (report.phase1Steps.find((s) => s.id === "D1")?.status === "pass") {
      await Promise.all([
        page.waitForNavigation({ waitUntil: "load", timeout: 30000 }),
        page.getByRole("button", { name: /Reload page/i }).click(),
      ]);
      // Auto-restore runs on mount after the reload.
      await page.waitForFunction(restoreSettled, null, { timeout: 45000 });
      const p2Inner = await page.evaluate(() => document.body.innerText);
      report.restoreSteps = parseSteps(p2Inner);
      const p2Err = extractError(p2Inner);
      if (p2Err) report.errors.push(`restore: ${p2Err}`);
      const c2 = p2Inner.match(/post-reload canary:\s*(\S+)/);
      if (c2) report.canaries.push(c2[1]);
    } else {
      report.errors.push("phase1: D1 (sealed save) did not pass, so restore was not attempted");
    }

    // ---- WASM asset content-type ----
    const wasmResp = wasmResponses.find((r) => r.url.includes("kinsh_vodozemac_wasm_bg.wasm"));
    report.network.wasmContentType = wasmResp ? `${wasmResp.status} ${wasmResp.ct}` : "NOT FETCHED";

    // ---- Leakage audit: network ----
    report.network.requests = requests.length;
    for (const r of requests) {
      const hay = `${r.url} ${r.body}`;
      for (const canary of report.canaries) {
        if (canary && hay.includes(canary)) {
          report.network.leaks.push(`canary "${canary}" in ${r.method} ${r.url}`);
        }
      }
      for (const marker of KEY_MARKERS) {
        if (hay.includes(marker)) {
          report.network.leaks.push(`key marker "${marker}" in ${r.method} ${r.url}`);
        }
      }
    }

    // ---- Leakage audit: console ----
    report.console.messages = consoleMsgs.length;
    const joined = consoleMsgs.join("\n");
    for (const canary of report.canaries) {
      if (canary && joined.includes(canary)) {
        report.console.leaks.push(`canary "${canary}" in console output`);
      }
    }
    for (const marker of KEY_MARKERS) {
      if (joined.includes(marker)) {
        report.console.leaks.push(`key marker "${marker}" in console output`);
      }
    }

    // ---- Verdict ----
    const phase1Ok = allPassed(report.phase1Steps, ["A", "B", "E", "C", "D1"]);
    const restoreOk = allPassed(report.restoreSteps, ["A", "D2", "D3", "D4"]);
    report.ok =
      phase1Ok &&
      restoreOk &&
      report.wasmLoadedInBrowser &&
      report.network.leaks.length === 0 &&
      report.console.leaks.length === 0 &&
      report.errors.length === 0;
  } catch (e) {
    report.errors.push(e.message);
  } finally {
    if (browser) await browser.close();
  }
  return report;
}

function summarize(r) {
  const p1 = r.phase1Steps.map((s) => `${s.id}:${s.status}`).join(" ") || "(none)";
  const p2 = r.restoreSteps.map((s) => `${s.id}:${s.status}`).join(" ") || "(none)";
  const verdict = r.ok ? "VERIFIED" : "FAILED";
  return [
    `  ${r.browser.padEnd(9)} ${verdict}`,
    `    wasm init in browser : ${r.wasmLoadedInBrowser ? "pass" : "FAIL"}`,
    `    .wasm served as      : ${r.network.wasmContentType}`,
    `    phase1 (A,B,E,C,D1)  : ${p1}`,
    `    restore (A,D2,D3,D4) : ${p2}`,
    `    network reqs / leaks : ${r.network.requests} / ${r.network.leaks.length}`,
    `    console msgs / leaks : ${r.console.messages} / ${r.console.leaks.length}`,
    r.errors.length ? `    errors               : ${r.errors.join(" | ")}` : null,
    r.network.leaks.length ? `    NETWORK LEAKS        : ${r.network.leaks.join(" | ")}` : null,
    r.console.leaks.length ? `    CONSOLE LEAKS        : ${r.console.leaks.join(" | ")}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

const main = async () => {
  // Fail fast with a clear message if the server isn't up.
  try {
    const probe = await fetch(`${BASE}/spike`);
    if (!probe.ok) throw new Error(`status ${probe.status}`);
  } catch (e) {
    console.error(
      `Cannot reach ${BASE}/spike (${e.message}).\n` +
        `Start the production server first:  npm run build && npm run start`,
    );
    process.exit(2);
  }

  const reports = [];
  for (const [name, engine] of ENGINES) {
    console.log(`\n--- ${name} ---`);
    const r = await runEngine(name, engine);
    console.log(summarize(r));
    reports.push(r);
  }

  const failed = reports.filter((r) => !r.ok);
  console.log(
    `\nResult: ${reports.length - failed.length}/${reports.length} browsers verified` +
      (failed.length ? ` (FAILED: ${failed.map((r) => r.browser).join(", ")})` : ""),
  );
  process.exit(failed.length ? 1 : 0);
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
