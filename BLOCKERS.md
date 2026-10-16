# Blockers & Limitations — Phase 0.5 Spike

**Showstopper verdict: none.** The binding was verified sufficiently to pass
every spike check (A–F) in Node and in three browser engines, so Phase 1 may
proceed with `@kinsh/vodozemac-wasm@0.4.2` (pinned). The items below are
constraints to carry forward, each with its mitigation.

## Hard constraints (cannot be resolved in this environment)

### 1. The WASM binary cannot be rebuilt or source-audited
- **What:** no Rust/cargo toolchain here, so we cannot reproduce the
  `wasm-pack` build of `@kinsh/vodozemac-wasm` or read/audit the upstream
  vodozemac Rust source compiled into it.
- **Evidence we DO have:** npm provenance (SLSA v1, build from the public
  GitHub repo), Apache-2.0 license, `vodozemac-0.10.0` version string embedded
  in the published binary, thin TypeScript glue (`src/lib.rs` reviewed in the
  tarball), `SessionConfig::version_1()`, and passing behavioral tests.
- **Mitigation:** treat provenance + artifact inspection + behavioral tests as
  the verification floor; **schedule a source-level review of vodozemac and
  the binding when a Rust-capable environment is available** (before Phase 7
  go/no-go).

### 2. Official known-answer test vectors are not runnable
- **What:** upstream vodozemac ships its KATs as Rust `#[test]` code — there
  are no standalone vector files, and no Rust toolchain to run them.
- **Mitigation:** the Megolm vectors in `tests/vectors/` are
  **binding-author-generated** (their `generate-test-vectors.mjs`), vendored
  verbatim with provenance documented in `tests/vectors/README.md`. Our
  tests additionally assert live round-trip and tamper behavior. Recorded as
  a limitation: *no official Matrix KAT was executed in this spike.*

### 3. The binding lags upstream vodozemac
- **What:** `@kinsh/vodozemac-wasm@0.4.2` embeds vodozemac **0.10.0**;
  crates.io latest is **0.11.1**. Bug fixes/security patches in 0.11.x are
  not in our binary, and the binding may not update promptly.
- **Mitigation:** dependency is **exact-pinned**; re-check binding and
  upstream versions at each phase gate. If the binding stalls, fall back to
  options: build the binding ourselves in a Rust environment (requires #1's
  toolchain), switch to a different maintained binding, or re-evaluate
  OpenMLS / a Matrix-spec-compliant alternative (planned for Phase 7).

## Coverage gaps (honest reporting)

### 4. Safari-the-app and iOS are unverified
- WebKit 27.2 (Playwright) is Safari's engine and passed every check, but no
  real Safari app, iOS, or macOS run happened.
- **Mitigation:** before any production decision, run `/spike` manually in
  Safari on a real device: `npm run build && npm run start`, open
  `http://<host>:3000/spike`, run both phases, confirm all steps pass.

### 5. Spike storage model is intentionally not production-grade
- The AES-GCM sealing key lives in a separate IndexedDB record — an attacker
  with script execution can read both. Fine for throwaway spike data; **it
  would be a real vulnerability in production.**
- **Mitigation:** production key management (passphrase-derived KEK, Web
  Crypto non-extractable keys, recovery secret — Phase 0 decision 3) is a
  Phase 1 design item, not carried over from the spike.

## Not blockers — open Phase 0 decisions still to resolve

These were deliberately out of scope for the spike and must be settled before
Phase 1 implementation:

1. ~~binding strategy~~ — **resolved by this spike**: proceed with
   `@kinsh/vodozemac-wasm@0.4.2` pinned; re-evaluate at Phase 7.
2. Megolm-content vs per-recipient Olm fan-out for message delivery.
3. Form of the recovery secret (and how it protects the at-rest pickle).
4. Accept v1 truncated 8-byte MAC as-is or configure differently.
5. No post-quantum KEX (Curve25519 only) for v1 — accept or defer.
6. Metadata exposure of typing indicators / read receipts.
8. Malicious-deployment posture (what the server can and cannot be allowed
   to do).

## Environment notes for reproducers

- Browser binaries come from `cdn.playwright.dev` via
  `npx playwright-core install <engine>` (~400 MiB total; worked in this
  environment).
- `verify:browser` requires a running production server; it exits `2` with a
  clear message if `SPIKE_BASE_URL` is unreachable and `1` if any engine
  fails.
