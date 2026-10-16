// Phase 1.1 — automated accessibility scan (axe-core) against the real
// production build in Playwright.
//
// Scans every screen at desktop size, re-scans key screens at mobile size,
// and scans transient states (open pairing dialog, open chat demo menu)
// where dialog/menu semantics apply. Scans run in BOTH color schemes because
// theme-init.js follows prefers-color-scheme on first visit (dark is the
// documented default, light comes from the OS or a stored preference).
//
// Usage:
//   node scripts/verify-a11y.mjs           # both schemes (default)
//   node scripts/verify-a11y.mjs dark      # dark only
//   node scripts/verify-a11y.mjs light     # light only
//
// Assumes the production server is already running (see README):
//   A11Y_BASE_URL overrides http://localhost:3111

import { chromium } from "playwright-core";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core"); // axe.js from node_modules — no CDN

const BASE = process.env.A11Y_BASE_URL || "http://localhost:3111";
const SEED_TEXT = "Morning! Did the prototype build go through?";

const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 375, height: 812 };

const arg = process.argv[2];
const SCHEMES =
  arg === "dark" ? ["dark"] : arg === "light" ? ["light"] : ["dark", "light"];

let checks = 0;
let failures = 0;
const lines = [];
const allViolations = [];

async function scan(page, label) {
  await page.addScriptTag({ path: AXE_PATH });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run(document, {
      resultTypes: ["violations"],
    });
    return result.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      count: v.nodes.length,
      targets: v.nodes.slice(0, 6).map((n) => n.target.join(" ")),
    }));
  });
  checks += 1;
  if (violations.length === 0) {
    lines.push(`PASS  axe scan: ${label} — 0 violations`);
  } else {
    failures += 1;
    lines.push(`FAIL  axe scan: ${label} — ${violations.length} violation rule(s)`);
    for (const v of violations) {
      lines.push(
        `      [${v.impact}] ${v.id} (${v.count} node${v.count > 1 ? "s" : ""}): ${v.help}`,
      );
      for (const t of v.targets) lines.push(`        - ${t}`);
    }
  }
  return violations;
}

async function signIn(page) {
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email", { exact: true }).fill("axe.user@example.com");
  await page.getByLabel("Password", { exact: true }).fill("axe-password-1");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/chat", { timeout: 10000 });
  await page.getByText(SEED_TEXT).waitFor({ timeout: 10000 });
}

async function assertBootTheme(page, scheme) {
  const theme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme"),
  );
  checks += 1;
  if (theme === scheme) {
    lines.push(`PASS  boot theme [${scheme}] — data-theme=${theme}`);
  } else {
    failures += 1;
    lines.push(`FAIL  boot theme [${scheme}] — data-theme=${theme}`);
  }
}

async function runScheme(browser, scheme) {
  // ---------- desktop ----------
  const ctx = await browser.newContext({ viewport: DESKTOP, colorScheme: scheme });
  const page = await ctx.newPage();

  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").waitFor();
  await assertBootTheme(page, scheme);
  allViolations.push(...(await scan(page, `/login (desktop, ${scheme})`)));

  await signIn(page);
  allViolations.push(...(await scan(page, `/chat (desktop, ${scheme})`)));

  // Transient state: open conversation demo menu (let the 0.16s open
  // animation settle — axe results are unreliable mid-CSS-animation)
  await page.getByRole("button", { name: "Conversation demo options" }).click();
  await page.getByRole("menu").waitFor();
  await page.waitForTimeout(300);
  allViolations.push(
    ...(await scan(page, `/chat with demo menu open (desktop, ${scheme})`)),
  );
  await page.keyboard.press("Escape");

  await page.locator('a[href="/devices"]:visible').first().click();
  await page.waitForURL("**/devices");
  await page.getByText("Pixel 9").waitFor();
  allViolations.push(...(await scan(page, `/devices (desktop, ${scheme})`)));

  // Transient state: open pairing dialog (settle for the open animation)
  await page.getByRole("button", { name: "Pair a new device" }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(300);
  allViolations.push(
    ...(await scan(page, `/devices pairing dialog open (desktop, ${scheme})`)),
  );
  await page.keyboard.press("Escape");

  await page.locator('a[href="/security"]:visible').first().click();
  await page.waitForURL("**/security");
  await page.getByText("Encryption status").waitFor();
  allViolations.push(...(await scan(page, `/security (desktop, ${scheme})`)));

  await page.locator('a[href="/recovery"]:visible').first().click();
  await page.waitForURL("**/recovery");
  await page.getByText("Recovery backup").waitFor();
  allViolations.push(...(await scan(page, `/recovery (desktop, ${scheme})`)));

  await page.locator('a[href="/settings"]:visible').first().click();
  await page.waitForURL("**/settings");
  await page.getByRole("heading", { name: "Appearance", exact: true }).waitFor();
  allViolations.push(...(await scan(page, `/settings (desktop, ${scheme})`)));

  await ctx.close();

  // ---------- mobile ----------
  const mctx = await browser.newContext({ viewport: MOBILE, colorScheme: scheme });
  const mpage = await mctx.newPage();

  await mpage.goto(`${BASE}/login`);
  await mpage.getByLabel("Email").waitFor();
  allViolations.push(...(await scan(mpage, `/login (mobile 375, ${scheme})`)));

  await signIn(mpage);
  allViolations.push(...(await scan(mpage, `/chat (mobile 375, ${scheme})`)));

  await mpage.locator('a[href="/devices"]:visible').first().click();
  await mpage.waitForURL("**/devices");
  await mpage.getByText("Pixel 9").waitFor();
  await mpage.getByRole("button", { name: "Pair a new device" }).click();
  await mpage.getByRole("dialog").waitFor();
  await mpage.waitForTimeout(300); // settle for the open animation
  allViolations.push(
    ...(await scan(mpage, `/devices pairing dialog open (mobile 375, ${scheme})`)),
  );

  await mctx.close();
}

const browser = await chromium.launch();
try {
  for (const scheme of SCHEMES) {
    console.log(`\n########## color scheme: ${scheme} ##########`);
    await runScheme(browser, scheme);
  }
} catch (err) {
  failures += 1;
  lines.push(`FAIL  harness error — ${err.message.split("\n")[0]}`);
  console.error(err);
} finally {
  await browser.close();
}

// Deduplicate repeated findings across scans for the summary.
const summary = new Map();
for (const v of allViolations) {
  const key = `${v.impact}:${v.id}`;
  summary.set(key, (summary.get(key) || 0) + 1);
}

console.log(lines.join("\n"));
console.log(`\n${"=".repeat(60)}`);
if (summary.size > 0) {
  console.log("Rules that fired (rule × scans):");
  for (const [key, n] of summary) console.log(`  ${key} × ${n}`);
}
console.log(`Accessibility scan: ${checks - failures}/${checks} checks clean`);
process.exit(failures === 0 ? 0 : 1);
