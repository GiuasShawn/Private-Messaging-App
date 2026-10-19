// Phase 1.1 — responsive viewport, keyboard, and leak verification harness.
//
// Drives the REAL production build (`next start`) in Playwright and asserts,
// at actual viewport sizes, that:
//   - navigation switches between the desktop sidebar and the mobile
//     header + bottom tab bar at the 767px breakpoint
//   - chat history, composer, dialogs, and pairing screens fit the viewport
//   - no unintended horizontal overflow occurs on any screen
//   - key controls are not covered/overlapped by other elements
//   - keyboard focus is visible and dialog focus is managed (trap, ESC,
//     focus restoration)
//   - NO outbound request (URL or body) carries user-entered content
//   - browser storage holds only namespaced UI preferences and never the
//     typed password or message content
//   - no console/page errors occur
//
// Assumes the production server is already running (see README):
//   node scripts/verify-ui.mjs   (UI_BASE_URL overrides http://localhost:3111)

import { chromium, firefox, webkit } from "playwright-core";

const BASE = process.env.UI_BASE_URL || "http://localhost:3111";

// Color scheme under test. Dark is Haven's documented default; run the suite
// again with UI_COLOR_SCHEME=light to verify the light theme. This also drives
// theme-init.js (which follows prefers-color-scheme on first visit).
const SCHEME = process.env.UI_COLOR_SCHEME === "light" ? "light" : "dark";

const EMAIL = "canary.user@example.com";
const PASSWORD = "canary-Pa55word-9000";
const MESSAGE = "viewport canary message 1337";

const VIEWPORTS = [
  { name: "mobile-375x812", width: 375, height: 812, mode: "mobile" },
  { name: "mobile-390x844", width: 390, height: 844, mode: "mobile" },
  { name: "tablet-768x1024", width: 768, height: 1024, mode: "desktop" },
  { name: "desktop-1440x900", width: 1440, height: 900, mode: "desktop" },
];

const SEED_TEXT = "Morning! Did the prototype build go through?";

let checks = 0;
let failures = 0;
const results = [];

function report(ok, label, detail = "") {
  checks += 1;
  if (!ok) failures += 1;
  results.push(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  if (!ok) console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
}

// ---- page helpers ---------------------------------------------------------

function trackNetwork(page) {
  const requests = [];
  page.on("request", (req) => {
    requests.push({
      method: req.method(),
      url: req.url(),
      body: req.postData() || "",
    });
  });
  return requests;
}

function trackErrors(page) {
  const errors = [];
  page.on("pageerror", (err) => errors.push(`pageerror: ${err.message}`));
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(`console.error: ${msg.text()}`);
  });
  return errors;
}

async function noHorizontalOverflow(page, label) {
  const m = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
    bodyScrollW: document.body.scrollWidth,
  }));
  report(
    m.scrollW <= m.clientW + 1 && m.bodyScrollW <= m.clientW + 1,
    `${label}: no horizontal overflow`,
    `scrollWidth=${m.scrollW}/${m.bodyScrollW} clientWidth=${m.clientW}`,
  );
}

/** Visible interactive elements must not stick out horizontally. */
async function controlsWithinViewport(page, label) {
  const offenders = await page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const out = [];
    const nodes = document.querySelectorAll(
      "button, a, input, textarea, [role='switch'], [role='menuitem'], h1",
    );
    for (const el of nodes) {
      const r = el.getBoundingClientRect();
      if (r.width <= 2 || r.height <= 2) continue; // hidden / sr-only
      if (el.getClientRects().length === 0) continue;
      if (r.left < -1 || r.right > vw + 1) {
        out.push(
          `${el.tagName.toLowerCase()}[${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 30)}] L=${Math.round(r.left)} R=${Math.round(r.right)} vw=${vw}`,
        );
      }
    }
    return out;
  });
  report(
    offenders.length === 0,
    `${label}: interactive elements within viewport width`,
    offenders.join(" | "),
  );
}

/** The element hit by elementFromPoint at a locator's center must be it. */
async function assertNotCovered(page, locator, label) {
  const box = await locator.boundingBox();
  if (!box) {
    report(false, label, "no bounding box");
    return;
  }
  const hit = await locator.evaluate((target) => {
    const r = target.getBoundingClientRect();
    const node = document.elementFromPoint(
      r.left + r.width / 2,
      r.top + r.height / 2,
    );
    if (!node) return { ok: false, path: "null" };
    return {
      ok: node === target || target.contains(node),
      path: node.outerHTML.slice(0, 120),
    };
  });
  report(
    hit.ok,
    `${label}: not covered by another element`,
    hit.ok ? "" : `hit: ${hit.path}`,
  );
}

async function assertNavMode(page, mode) {
  const aside = page.locator("aside");
  const topbar = page.locator("header").first();
  const bottomNav = page.locator("nav.bottomNav, nav[aria-label='Primary']").last();
  const visibleNavs = page.locator("nav[aria-label='Primary']:visible");
  const navCount = await visibleNavs.count();
  const navBox = navCount > 0 ? await visibleNavs.first().boundingBox() : null;
  const bottomNavVisible = await bottomNav.isVisible().catch(() => false);

  if (mode === "mobile") {
    report((await aside.count()) === 0 || !(await aside.isVisible()), "nav: sidebar hidden on mobile");
    report(await topbar.isVisible(), "nav: top status bar visible on mobile");
    report(navCount === 1, "nav: exactly one primary nav visible", `count=${navCount}`);
    report(!!navBox && navBox.y > 300, "nav: primary nav sits at the bottom", navBox ? `y=${Math.round(navBox.y)}` : "no box");
    report(bottomNavVisible, "nav: bottom tab bar visible on mobile");
  } else {
    report(await aside.isVisible(), "nav: sidebar visible on ≥768px");
    report(navCount === 1, "nav: exactly one primary nav visible", `count=${navCount}`);
    report(!!navBox && navBox.x < 400, "nav: primary nav is the left sidebar", navBox ? `x=${Math.round(navBox.x)}` : "no box");
    report(!bottomNavVisible, "nav: bottom tab bar hidden on desktop");
  }
}

async function signIn(page) {
  await page.goto(`${BASE}/login`);
  // Real keystrokes instead of fill(): Playwright's fill() sets the DOM value
  // but does not reach React's controlled state in WebKit, while typing (like
  // a real user) works in all engines.
  const email = page.getByLabel("Email", { exact: true });
  await email.click();
  await email.press("ControlOrMeta+a");
  await email.type(EMAIL, { delay: 10 });
  const pw = page.getByLabel("Password", { exact: true });
  await pw.click();
  await pw.press("ControlOrMeta+a");
  await pw.type(PASSWORD, { delay: 10 });
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("**/chat", { timeout: 10000 });
  await page.getByText(SEED_TEXT).waitFor({ timeout: 10000 });
}

async function gotoViaNav(page, href) {
  await page.locator(`a[href="${href}"]:visible`).first().click();
  await page.waitForURL((u) => u.pathname === href, { timeout: 10000 });
}

// ---- viewport suite -------------------------------------------------------

async function runViewport(browser, vp) {
  console.log(`\n=== ${vp.name} (${vp.mode} mode expected) ===`);
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    colorScheme: SCHEME,
  });
  const page = await context.newPage();
  const requests = trackNetwork(page);
  const errors = trackErrors(page);

  // 1. Login screen fits + theme bootstraps to the expected scheme
  await page.goto(`${BASE}/login`);
  await page.getByLabel("Email").waitFor();
  const bootTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme"),
  );
  report(
    bootTheme === SCHEME,
    `/login: theme bootstraps to ${SCHEME} (theme-init.js)`,
    `data-theme=${bootTheme}`,
  );
  await noHorizontalOverflow(page, "/login");
  await controlsWithinViewport(page, "/login");

  // 2. Keyboard: visible focus indicator on tabbed-to controls.
  //    Text inputs intentionally use border-color + soft halo instead of an
  //    outline; buttons/links use the global :focus-visible outline. Either
  //    counts as a visible indicator as long as one is actually applied.
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  const focusInfo = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return null;
    const cs = getComputedStyle(el);
    return {
      tag: el.tagName.toLowerCase(),
      outlineStyle: cs.outlineStyle,
      outlineWidth: cs.outlineWidth,
      boxShadow: cs.boxShadow,
      borderColor: cs.borderColor,
    };
  });
  const hasOutline =
    !!focusInfo &&
    focusInfo.outlineStyle === "solid" &&
    focusInfo.outlineWidth !== "0px";
  const hasHalo = !!focusInfo && focusInfo.boxShadow !== "none";
  report(
    hasOutline || hasHalo,
    "/login: keyboard focus shows a visible indicator (outline or halo)",
    focusInfo
      ? `${focusInfo.tag} outline=${focusInfo.outlineStyle} ${focusInfo.outlineWidth} shadow=${focusInfo.boxShadow.slice(0, 60)}`
      : "no focusable element reached",
  );

  // 3. Sign in and verify nav mode
  await signIn(page);
  await assertNavMode(page, vp.mode);

  // 4. Chat fits: composer fully on screen, list has no overflow
  const composer = page.getByLabel("Message Alex Mercer", { exact: true });
  await composer.waitFor();
  const cBox = await composer.boundingBox();
  report(
    !!cBox &&
      cBox.x >= -1 &&
      cBox.x + cBox.width <= vp.width + 1 &&
      cBox.y >= -1 &&
      cBox.y + cBox.height <= vp.height + 1,
    "/chat: composer fully within viewport",
    cBox ? JSON.stringify({ x: Math.round(cBox.x), y: Math.round(cBox.y), r: Math.round(cBox.x + cBox.width), b: Math.round(cBox.y + cBox.height) }) : "no box",
  );
  await noHorizontalOverflow(page, "/chat");
  await controlsWithinViewport(page, "/chat");

  // 5. Send a message; the new bubble must fit horizontally
  await composer.click();
  await page.keyboard.type(MESSAGE);
  await page.keyboard.press("Enter");
  const bubble = page.getByText(MESSAGE);
  await bubble.waitFor({ timeout: 5000 });
  const bBox = await bubble.boundingBox();
  report(
    !!bBox && bBox.x >= -1 && bBox.x + bBox.width <= vp.width + 1,
    "/chat: sent message bubble fits viewport width",
    bBox ? `right=${Math.round(bBox.x + bBox.width)} vw=${vp.width}` : "no box",
  );
  await noHorizontalOverflow(page, "/chat (after send)");

  // 6. Key controls are not covered (composer, send, nav)
  await assertNotCovered(page, composer, "/chat: composer textarea");
  await assertNotCovered(
    page,
    page.getByRole("button", { name: "Send message" }),
    "/chat: send button",
  );
  if (vp.mode === "mobile") {
    await assertNotCovered(
      page,
      page.locator("header").first(),
      "/chat: mobile header",
    );
    await assertNotCovered(
      page,
      page.locator("nav[aria-label='Primary']:visible").first(),
      "/chat: bottom tab bar",
    );
  }

  // 7. Devices: usable, dialogs fit
  await gotoViaNav(page, "/devices");
  await page.getByText("Pixel 9").waitFor();
  await noHorizontalOverflow(page, "/devices");
  await controlsWithinViewport(page, "/devices");
  const approveBtn = page.getByRole("button", { name: "Approve" });
  await approveBtn.scrollIntoViewIfNeeded();
  await approveBtn.click();
  // The pending badge and its amber "Requested …" activity text disappear
  // from the device row (the stat-strip label "Pending approval" remains).
  await page.getByText(/Requested \d+ min ago/).waitFor({ state: "detached", timeout: 3000 }).catch(() => {});
  report(
    (await page.getByText(/Requested \d+ min ago/).count()) === 0,
    "/devices: approve action works in real browser",
  );

  // Pairing dialog: fits viewport, focus enters dialog, trap + ESC restore
  const pairTrigger = page.getByRole("button", { name: "Pair a new device" });
  await pairTrigger.scrollIntoViewIfNeeded();
  await pairTrigger.click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const dBox = await dialog.boundingBox();
  report(
    !!dBox &&
      dBox.x >= -1 &&
      dBox.x + dBox.width <= vp.width + 1 &&
      dBox.y >= -1 &&
      dBox.y + dBox.height <= vp.height + 1,
    "/devices: pairing dialog fits viewport",
    dBox ? JSON.stringify({ x: Math.round(dBox.x), y: Math.round(dBox.y), r: Math.round(dBox.x + dBox.width), b: Math.round(dBox.y + dBox.height), vw: vp.width, vh: vp.height }) : "no box",
  );
  const focusInDialog = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog']");
    return !!dlg && dlg.contains(document.activeElement);
  });
  report(focusInDialog, "/devices: focus moves into the open dialog");
  for (let i = 0; i < 6; i += 1) {
    await page.keyboard.press("Tab");
  }
  const stillTrapped = await page.evaluate(() => {
    const dlg = document.querySelector("[role='dialog']");
    return !!dlg && dlg.contains(document.activeElement);
  });
  report(stillTrapped, "/devices: focus stays trapped inside the dialog");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached", timeout: 3000 });
  const restored = await pairTrigger.evaluate((el) => el === document.activeElement);
  report(restored, "/devices: ESC closes dialog and restores focus to trigger");

  // Revoke confirmation dialog fit (mobile especially)
  const revokeBtn = page.getByRole("button", { name: "Revoke" }).first();
  await revokeBtn.scrollIntoViewIfNeeded();
  await revokeBtn.click();
  const revokeDialog = page.getByRole("dialog");
  await revokeDialog.waitFor();
  const rBox = await revokeDialog.boundingBox();
  report(
    !!rBox && rBox.x >= -1 && rBox.x + rBox.width <= vp.width + 1 && rBox.y + rBox.height <= vp.height + 1,
    "/devices: revoke dialog fits viewport",
    rBox ? `w=${Math.round(rBox.width)} b=${Math.round(rBox.y + rBox.height)} vh=${vp.height}` : "no box",
  );
  await page.keyboard.press("Escape");
  await revokeDialog.waitFor({ state: "detached" });

  // 8–9. Security and Recovery are out of primary nav; their routes remain
  //      live and are reached through the Settings module links. Navigation
  //      must be client-side: a full page load would remount the app and the
  //      in-memory mock session (like a real refresh) returns to /login.
  await gotoViaNav(page, "/settings");
  await page.locator('a[href="/security"]:visible').first().click();
  await page.waitForURL("**/security");
  await page.getByText("Encryption status").waitFor();
  await noHorizontalOverflow(page, "/security");
  await controlsWithinViewport(page, "/security");
  const receiptSwitch = page.getByRole("switch", { name: "Send read receipts" });
  await receiptSwitch.scrollIntoViewIfNeeded();
  const before = await receiptSwitch.getAttribute("aria-checked");
  await receiptSwitch.click();
  const after = await receiptSwitch.getAttribute("aria-checked");
  report(before !== after, "/security: privacy toggle toggles", `${before} → ${after}`);

  // Back to Settings, then into Recovery via its module link.
  await page.goBack();
  await page.waitForURL("**/settings");
  await page.locator('a[href="/recovery"]:visible').first().click();
  await page.waitForURL("**/recovery");
  await noHorizontalOverflow(page, "/recovery");
  await controlsWithinViewport(page, "/recovery");
  const setupBtn = page.getByRole("button", { name: "Set up recovery (simulated)" });
  await setupBtn.scrollIntoViewIfNeeded();
  await setupBtn.click();
  await page.getByText("Backup set up (simulated)").waitFor({ timeout: 6000 });
  report(true, "/recovery: simulated setup flow completes in real browser");
  await noHorizontalOverflow(page, "/recovery (result)");
  await controlsWithinViewport(page, "/recovery (result)");

  // 10. Settings: theme switch works
  await page.goBack();
  await page.waitForURL("**/settings");
  await page.getByRole("heading", { name: "Appearance", exact: true }).waitFor();
  await noHorizontalOverflow(page, "/settings");
  await controlsWithinViewport(page, "/settings");
  const lightBtn = page.getByRole("button", { name: "Light" });
  await lightBtn.scrollIntoViewIfNeeded();
  await lightBtn.click();
  const theme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme"),
  );
  report(theme === "light", "/settings: theme selector switches to light", `data-theme=${theme}`);

  // 11. Leak audits (real browser)
  const nonSameOrigin = requests.filter(
    (r) =>
      !r.url.startsWith(BASE) &&
      !r.url.startsWith("data:") &&
      !r.url.startsWith("blob:"),
  );
  report(
    nonSameOrigin.length === 0,
    `${vp.name}: no third-party network requests`,
    nonSameOrigin.map((r) => r.url).join(" | "),
  );
  const leaky = requests.filter(
    (r) =>
      r.url.includes(PASSWORD) ||
      r.url.includes(MESSAGE) ||
      r.body.includes(PASSWORD) ||
      r.body.includes(MESSAGE),
  );
  report(
    leaky.length === 0,
    `${vp.name}: no request URL/body carries user-entered content`,
    leaky.map((r) => `${r.method} ${r.url}`).join(" | "),
  );
  const storage = await page.evaluate(() => {
    const out = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      out.push([k, window.localStorage.getItem(k) || ""]);
    }
    return out;
  });
  const badKeys = storage.filter(([k]) => !k.startsWith("messenger.ui."));
  const leakyValues = storage.filter(
    ([, v]) => v.includes(PASSWORD) || v.includes(MESSAGE),
  );
  report(
    badKeys.length === 0,
    `${vp.name}: storage keys are namespaced UI prefs only`,
    badKeys.map(([k]) => k).join(" | "),
  );
  report(
    leakyValues.length === 0,
    `${vp.name}: storage never contains password or message content`,
  );
  report(
    errors.length === 0,
    `${vp.name}: no console/page errors`,
    errors.join(" | "),
  );

  await context.close();
}

// ---- cross-engine smoke ---------------------------------------------------

async function runEngineSmoke(browserType, engineName) {
  for (const vp of [
    { name: `${engineName}-375`, width: 375, height: 812, mode: "mobile" },
    { name: `${engineName}-1440`, width: 1440, height: 900, mode: "desktop" },
  ]) {
    console.log(`\n=== smoke: ${vp.name} ===`);
    const context = await browserType.newContext({
      viewport: { width: vp.width, height: vp.height },
      colorScheme: SCHEME,
    });
    const page = await context.newPage();
    const errors = trackErrors(page);
    try {
      await signIn(page);
      report(true, `${vp.name}: sign-in and chat render`);
      await assertNavMode(page, vp.mode);
      await noHorizontalOverflow(page, vp.name);
      const cBox = await page.getByLabel("Message Alex Mercer").boundingBox();
      report(
        !!cBox && cBox.x + cBox.width <= vp.width + 1 && cBox.y + cBox.height <= vp.height + 1,
        `${vp.name}: composer fits viewport`,
      );
      report(errors.length === 0, `${vp.name}: no console/page errors`, errors.join(" | "));
    } catch (err) {
      report(false, `${vp.name}: smoke flow`, err.message.split("\n")[0]);
    }
    await context.close();
  }
}

// ---- main -----------------------------------------------------------------

const engineArg = process.argv[2] || "chromium";

try {
  if (engineArg === "chromium" || engineArg === "all") {
    const browser = await chromium.launch();
    for (const vp of VIEWPORTS) await runViewport(browser, vp);
    await browser.close();
  }
  if (engineArg === "firefox" || engineArg === "all") {
    const browser = await firefox.launch();
    await runEngineSmoke(browser, "firefox");
    await browser.close();
  }
  if (engineArg === "webkit" || engineArg === "all") {
    const browser = await webkit.launch();
    await runEngineSmoke(browser, "webkit");
    await browser.close();
  }
} catch (err) {
  failures += 1;
  results.push(`FAIL  harness error — ${err.message}`);
  console.error(err);
}

console.log(`\n${"=".repeat(60)}`);
for (const line of results) console.log(line);
console.log("=".repeat(60));
console.log(`UI verification: ${checks - failures}/${checks} checks passed`);
process.exit(failures === 0 ? 0 : 1);
