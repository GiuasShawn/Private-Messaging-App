# Haven — Private Two-Person Messenger

A private, two-person, end-to-end-encrypted messenger (Next.js +
TypeScript). Development proceeds in phases; this repository currently
contains:

- **Phase 0.5 — cryptographic feasibility spike:** complete and verified in
  three browser engines (see the appendix below, plus
  [SECURITY-NOTE.md](./SECURITY-NOTE.md)).
- **Phase 1 — interface prototype (current):** a polished, responsive,
  dark-first UI for every screen, built entirely on **mock data and local
  state**. No backend, no real accounts, no integrated cryptography.

> **Phase 1 honesty note:** nothing in the UI encrypts, transmits, uploads,
> verifies, or recovers anything. Authentication is mock, attachments never
> leave the device, and recovery generates no secret. Each screen says so
> inline, and `tests/ui/leak-guard.test.tsx` asserts a full interaction pass
> makes **zero network calls** and stores **no secrets**.

## Phase 1 — interface prototype

### Screens

| Route | Screen | Notes |
|---|---|---|
| `/login` | Sign-in | Email + password, visibility toggle, validation; any email + 8+ char password is accepted (disclosed inline) |
| `/chat` | Main chat | Header/presence, date-separated history, composer (Enter sends, Shift+Enter newline, IME-safe), simulated sending→sent→delivered→read receipts, mock typing indicator + canned replies, loading/error/empty states via a demo menu |
| — | Attachments | Picker for images/files, size (25 MB) + type validation, simulated upload progress, local `blob:` previews; clearly labelled simulated |
| `/devices` | Device management | Pending/approved/revoked states, mock approve + revoke (with confirm), pairing dialog with a placeholder code, honest verification labels ("Verified (simulated)") |
| `/security` | Security settings | Encryption/verification/recovery/session panels; copy separates what the spike proved from what is wired |
| `/recovery` | Recovery | Button-driven simulated setup + restore flows; generates/stores no secret; explains secret ≠ password and the loss consequences |
| `/settings` | General settings | Theme (dark/light), profile display name + avatar preview, notification and privacy preferences |

### Architecture

```
app/            routes (login, chat, devices, security, recovery, settings, spike)
components/
  ui/           primitives: buttons, fields, password toggle, switch, select,
                avatar, badges, panels, accessible dialog, tooltip, icons
  shell/        responsive AppShell: labeled sidebar (desktop) / header +
                bottom tab bar (phones), mock-auth route guard
  auth/ chat/ devices/ security/ recovery/ settings/   screens
lib/
  ui/           theme store, mock auth, namespaced prefs store, chat logic
  mock/         strict types + mock data (devices, conversation, partner)
tests/
  spike.test.ts 17 crypto-spike tests (node env, unchanged)
  ui/*.test.tsx 27 UI tests (jsdom + Testing Library)
```

Design system: CSS custom properties in `app/globals.css` (dark default, light
via `data-theme`), Geist via `next/font`, one CSS module per area, focus-visible
rings, `prefers-reduced-motion` support, WCAG-minded labels/roles.

### What is stored locally (and nothing else)

| Key | Contents |
|---|---|
| `messenger.ui.theme` | `dark` or `light` |
| `messenger.ui.prefs` | display name + notification/privacy toggles |

No passwords, private keys, recovery secrets, or message content are ever
persisted; the mock session is in-memory only (refresh returns you to
`/login`).

### Running Phase 1

```bash
npm install
npm run dev        # http://localhost:3000 → /login
npm test           # 44 tests: 17 spike (node) + 27 UI (jsdom)
npm run lint && npm run typecheck && npm run build
```

### Known Phase 1 limitations

- Responsive behavior is CSS-driven; automated tests assert landmarks and
  interactions, not media-query rendering (no visual-regression suite yet).
- The mock typing indicator ignores the privacy toggle by design (disclosed
  in the UI) — wiring preference-aware behavior needs a real messaging layer.
- Safari was engine-tested only during Phase 0.5; the Phase 1 UI has not been
  manually verified in the Safari app (see BLOCKERS.md).
- No visual-regression or axe accessibility scan in this phase; accessibility
  is via semantic markup, roles, labels, focus management, and keyboard paths.

### Phase 1 file changes (summary)

New: `lib/mock/*`, `lib/ui/*`, `components/**`, `app/{login,chat,devices,security,recovery,settings}/`, `tests/setup.ts`, `tests/ui/*`, `public/theme-init.js`.
Modified: `app/layout.tsx` (providers, theme script, metadata), `app/globals.css` (design tokens), `vitest.config.ts` (jsdom UI tests), `package.json` (pinned dev deps: jsdom, Testing Library).
Removed: scaffold boilerplate (`app/page.tsx` starter, `app/page.module.css`, unused `public/*.svg`).
Untouched: `lib/spike/`, `app/spike/`, `tests/spike.test.ts`, `tests/vectors/`, `scripts/`, and the pinned crypto dependency.

---

# Appendix — Phase 0.5: Browser-Cryptography Feasibility Spike

A minimal, isolated spike that answers one question before any messenger is
built: **can `@kinsh/vodozemac-wasm` establish Olm sessions, reject tampered
ciphertext, persist a session across a real page reload, and run Megolm — in a
real browser, without leaking plaintext or key material?**

This is deliberately **not** a messenger. There are no accounts, no server, no
Supabase, no chat UI, and no custom crypto. Everything lives under `lib/spike/`
plus one page (`/spike`), so the whole spike can be deleted in one commit when
Phase 1 begins.

## Verified results (honest status)

| Check | Node (Vitest) | Chromium 156 | Firefox 157 | WebKit 27.2 |
|---|---|---|---|---|
| A. WASM init + identity minted | pass | pass | pass | pass |
| B. Olm session establish/encrypt/decrypt (both directions) | pass | pass | pass | pass |
| C. Tampered-ciphertext rejection (asserted as MAC/signature failure) | pass | pass | pass | pass |
| D1. Pickle → AES-GCM → IndexedDB sealed save | pass | pass | pass | pass |
| D2. Reload → session restored from sealed pickle | pass | pass | pass | pass |
| D3. Restored session continues the ratchet | pass | pass | pass | pass |
| D4. Megolm continues after restore | pass | pass | pass | pass |
| E. Megolm round trip | pass | pass | pass | pass |
| F. No plaintext/keys on the wire or in console | pass (instrumented) | 27 reqs, 0 leaks | 28 reqs, 0 leaks | 27 reqs, 0 leaks |

- Browsers were driven with Playwright against a **production `next build` +
  `next start`** server (`scripts/verify-browser.mjs`).
- The `.wasm` asset is served with `Content-Type: application/wasm` (required
  for streaming instantiation) in all three engines.
- Safari itself (the macOS/iOS app) was **not** tested; WebKit is its engine,
  so this is engine-level coverage, not a Safari-app run.
- These results are a **feasibility spike**, not a security certification.
  See [SECURITY-NOTE.md](./SECURITY-NOTE.md) for exactly what is and is not
  proven.

## Running it

```bash
npm install          # postinstall copies the .wasm into public/wasm/
npm run lint         # eslint
npm run typecheck    # tsc --noEmit
npm test             # 17 Vitest tests (Node + fake-indexeddb), offline
npm run build        # production build (/spike is prerendered static)
npm run dev          # dev server → http://localhost:3000/spike
```

Cross-browser verification (needs browsers + a running production server):

```bash
npx playwright-core install chromium firefox webkit   # one-time, ~400 MiB
npm run build && npm run start &                       # prod server on :3000
SPIKE_BASE_URL=http://localhost:3000 npm run verify:browser
```

`verify:browser` exits non-zero if any engine fails a step or if a canary /
key marker appears in any request body, URL, or console line.

## What's here

```
lib/spike/
  wasm.ts     dual loader: pkg-web (browser, same-origin /wasm/... URL) and
              pkg-node (Vitest/Node, synchronous self-init); sanitizeError
  crypto.ts   Account/Session/GroupSession wrappers, handshake, base64
              (standard, unpadded — verified), byte-flip tamper helpers,
              errorText/isOlmMacFailure/isMegolmRejection (throws are raw
              strings, not Error objects)
  store.ts    AES-GCM-256 sealing + IndexedDB records (two stores: sealed
              envelopes and the throwaway local key), memoized key creation
  run.ts      the shared step runner — SAME code executes in the browser page
              and in Vitest: A, B, C, E, F, D1–D4
app/spike/page.tsx   client-only UI: run phase 1, then a REAL page reload and
                     restore; shows each step's status + fetch monitor
tests/spike.test.ts  17 Vitest tests (A–F, D1–D4)
tests/vectors/       vendored Megolm vectors + provenance README
scripts/copy-wasm.mjs      postinstall: copy pkg-web .wasm → public/wasm/
scripts/verify-browser.mjs Playwright harness for Chromium/Firefox/WebKit
```

### The spike page flow

1. **Run** → A (WASM init) → B (Olm handshake, both directions) → E (Megolm
   round trip) → C (one-bit flips rejected; control still decrypts) → F
   (envelope audit) → D1 (pickle sealed with AES-GCM, written to IndexedDB).
2. **Reload** → a `sessionStorage` flag triggers a genuine page reload; on
   mount the page re-inits WASM (A), unseals the pickle (D2), continues the
   Olm ratchet with the restored session (D3), and sends/receives a Megolm
   message (D4).

The canaries are test plaintext (never secrets), generated inside
handlers/effects — not during render, so Next can statically prerender the
route (Next 16 rejects `Math.random()` in a client component's render path).

## Findings that shaped the design

1. **`pickle()` takes no key and returns plaintext JSON with raw private keys.**
   The binding's own source says at-rest encryption is the application's job,
   so the app **must** AES-GCM-seal pickles before touching IndexedDB — which
   is exactly what `store.ts` does. (Production will need a real key hierarchy;
   the spike's throwaway key lives in a separate IDB record and is documented
   as spike-only.)
2. **The binding throws raw strings, not `Error`s.** `err.message` is
   `undefined`; use `errorText()` / `String(err)`.
3. **Base64 is standard and unpadded** (`+/`), despite a source comment
   claiming URL-safe. Verified against real identity keys; the tamper helpers
   re-encode with the same alphabet so tests exercise the MAC, not the decoder.
4. **Olm messages are Protobuf-framed:** byte 0 is a version check, bytes 1–2
   framing (both rejected *before* the MAC runs), byte ≥ 3 is authenticated
   payload where flips fail with `invalid MAC: MAC tag mismatch`. Tests assert
   the authentication failure specifically, so they cannot pass on a decode
   error.
5. **`@kinsh/vodozemac-wasm@0.4.2` embeds vodozemac 0.10.0** (upstream latest
   is 0.11.1 — the binding lags one minor version), is Apache-2.0, has npm
   provenance (SLSA v1), and uses `SessionConfig::version_1()`.

## Test-vector provenance

- `tests/vectors/megolm-v1.json` is **binding-author-generated** (their
  `scripts/generate-test-vectors.mjs`), vendored verbatim — see
  `tests/vectors/README.md`. It is **not** an official Matrix KAT.
- Upstream vodozemac has no standalone vector files; its known-answer tests
  are embedded in Rust test code, which can't run here (no Rust toolchain).
  This limitation is recorded in [BLOCKERS.md](./BLOCKERS.md).

## Removing the spike

Delete `lib/spike/`, `app/spike/`, `tests/spike.test.ts`, `tests/vectors/`,
`scripts/copy-wasm.mjs`, `scripts/verify-browser.mjs`, the
`postinstall`/`verify:browser` scripts, and the pinned spike-only deps
(`@kinsh/vodozemac-wasm`, `playwright-core`, `fake-indexeddb`). Keep `tests/`,
`tests/setup.ts`, and the UI-test toolchain — Phase 1 depends on them.
Nothing outside this list references spike code.

## Documents

- [SECURITY-NOTE.md](./SECURITY-NOTE.md) — what the spike does and does not prove
- [BLOCKERS.md](./BLOCKERS.md) — limitations, unverifiable items, open Phase 0 decisions
