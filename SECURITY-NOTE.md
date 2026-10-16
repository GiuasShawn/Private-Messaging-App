# Security Note — Phase 0.5 Spike

**Status: feasibility evidence only. Nothing here certifies production
security.** A successful round trip through this spike proves the library
loads and the API behaves as documented in the environments we ran; it does
not prove the future messenger will be secure.

## What WAS proven (with evidence)

1. **WASM loads and runs in real browsers.** `@kinsh/vodozemac-wasm@0.4.2`
   (pkg-web) initialized in Chromium 156, Firefox 157, and WebKit 27.2 against
   a production build; an identity could be minted in each. The `.wasm` is
   served as `application/wasm` (streaming-instantiation compatible).
2. **Olm session establishment and ratcheting works via the documented API.**
   `Account.createOutboundSession` / `createInboundSession` /
   `Session.encrypt` / `Session.decrypt` completed both directions (B).
3. **Tampered ciphertext is rejected by the authentication check — not merely
   "some exception".** For steady-state (type 1) Olm messages, byte flips at
   offsets ≥ 3 fail specifically with `invalid MAC: MAC tag mismatch`; the
   tests assert `isOlmMacFailure` so a malformed-base64 rejection (the bug we
   actually hit during development) can no longer satisfy them. Byte 0
   (version) and bytes 1–2 (framing) are rejected *earlier* by decode/version
   checks — still rejections, just not the MAC. Megolm flips are rejected by
   signature/protobuf/version checks. **A control message on a pristine
   session copy decrypts in every tamper test**, proving the rejection is
   caused by the flip itself. Caveat: a generic decryption exception alone is
   *not* proof — that is precisely why the MAC/signature-specific assertions
   were added after the first passing runs looked suspicious.
4. **Session continuity across a genuine page reload works, with at-rest
   sealing.** Pickle → AES-GCM-256 seal → IndexedDB (D1) → real reload →
   unseal (D2) → Olm ratchet continues (D3) → Megolm continues (D4), verified
   in Node and in all three browsers. The envelope audit checks sealed records
   contain no plaintext key markers.
5. **No plaintext or key material on the wire or in console — as observed in
   this spike's own traffic.** The browser harness recorded every request
   (URL + body) and every console/pageerror line across both phases and found
   0 occurrences of the canary plaintext or pickle-internal field markers
   (`signing_key`, `diffie_hellman`, `root_key`, `ratchet_key`, …): 27/28/27
   requests across Chromium/Firefox/WebKit. The only cross-origin traffic is
   Next's own static asset fetches; the spike performs no application network
   calls at all.
6. **Build hygiene.** lint, `tsc --noEmit`, 17 Vitest tests, and
   `next build` all pass; `/spike` prerenders statically.

## What was NOT proven (do not claim these)

- **Not a security audit.** No independent review of vodozemac, this binding,
  or this code. No formal verification, no fuzzing, no timing/side-channel
  analysis.
- **The WASM binary was not rebuilt or source-audited.** No Rust toolchain is
  available, so we inspected the published npm artifact (provenance, embedded
  vodozemac 0.10.0 version string, thin glue layer, `SessionConfig::version_1`)
  rather than reproducing the build. See BLOCKERS.md.
- **No official known-answer vectors were executed.** The Megolm vectors used
  are binding-author-generated, not Matrix KATs; upstream's KATs are Rust-only.
- **Pickles are NOT safe at rest without app-level sealing.** `pickle()`
  returns plaintext private keys. The spike seals them with AES-GCM, but the
  key itself sits in a *separate IndexedDB record* — fine for a throwaway
  spike, **not acceptable production key storage** (any XSS can read both).
- **No threat-model coverage:** malicious/compromised server, malicious
  deployment (decision 8), MITM at key-distribution time, replay,
  cross-device key sync, forward secrecy across reinstall, post-compromise
  security in the real app topology — none exercised.
- **Metadata is unaddressed:** who talks to whom, when, and how much is
  invisible to this spike but fully visible to any server (Phase 0 decisions
  2 and 6 remain open).
- **No post-quantum key exchange** (decision 5) — Curve25519 only.
- **Truncated (8-byte) MAC v1 acceptance** (decision 4) was a Phase 0
  discussion item, not validated here.
- **Safari the app was not tested** — only its engine (WebKit 27.2) via
  Playwright. No iOS/macOS run.
- **No denial-of-service, abuse, or rate-limiting behavior tested.**
- **The tamper tests run against freshly-constructed sessions.** They prove
  single-bit flips on valid messages fail auth; they do not model an
  adaptive attacker crafting arbitrary ciphertexts.

## Honest framing for the next phase

The spike demonstrates the *mechanism* end-to-end with real, documented APIs
and real browsers. It shifts "will this library work in a browser at all?"
from assumption to observation. It does not shift "is our messenger secure?"
— that remains the job of Phase 1+ design (key management, server posture,
metadata minimization) and, ultimately, external review.
