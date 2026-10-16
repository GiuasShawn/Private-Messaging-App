# Phase 0.5 — Browser-Cryptography Feasibility Spike

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

Delete `lib/spike/`, `app/spike/`, `tests/`, `scripts/copy-wasm.mjs`,
`scripts/verify-browser.mjs`, the `postinstall`/`test`/`typecheck`/
`verify:browser` scripts, and the pinned deps (`@kinsh/vodozemac-wasm`,
`vitest`, `fake-indexeddb`, `playwright-core`). Nothing outside this list
references spike code.

## Documents

- [SECURITY-NOTE.md](./SECURITY-NOTE.md) — what the spike does and does not prove
- [BLOCKERS.md](./BLOCKERS.md) — limitations, unverifiable items, open Phase 0 decisions
