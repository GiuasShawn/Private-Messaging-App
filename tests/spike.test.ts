/**
 * Phase 0.5 spike — automated tests.
 *
 * Coverage (mapped to the task's required list):
 *   1. WASM initialization
 *   2. Olm session establishment
 *   3. Successful encryption and decryption
 *   4. Rejection of tampered ciphertext
 *   5. Persistence and restoration of session state
 *   6. Continued session operation after restoration
 *   7. Megolm encryption and decryption (+ export-at-index boundary)
 *   8. No plaintext message content in outbound network requests
 *   9. No private keys or secrets in application logs
 *  10. Vendored Megolm vectors (binding-author-generated, NOT official
 *      upstream vodozemac KATs — see tests/vectors/README.md)
 *
 * These run against the pkg-node build of @kinsh/vodozemac-wasm in Node 24
 * with fake-indexeddb standing in for IndexedDB. Browser-specific behavior
 * (pkg-web init, real IndexedDB, real fetch) is exercised separately on the
 * /spike page and is reported as unverified in this environment.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { stepA_wasmInit } from "@/lib/spike/run";
import {
  createAccount,
  publishBundle,
  establishOlmSession,
  olmEncrypt,
  olmDecrypt,
  flipByte,
  megolmRoundTrip,
  megolmEncryptMany,
  megolmExportBoundary,
  errorText,
  isOlmMacFailure,
  isMegolmRejection,
} from "@/lib/spike/crypto";
import type { Vodozemac } from "@/lib/spike/wasm";

// Install fake-indexeddb before touching the store module.
import "fake-indexeddb/auto";

let v: Vodozemac;

beforeAll(async () => {
  const loaded = await stepA_wasmInit();
  if (loaded.result.status !== "pass") {
    throw new Error(`WASM init failed: ${loaded.result.detail}`);
  }
  v = loaded.v;
});

/* ------------------------------------------------------------------ *
 * 1. WASM initialization                                              *
 * ------------------------------------------------------------------ */

describe("1. WASM initialization", () => {
  it("loads the module and can mint an identity", async () => {
    const { result } = await stepA_wasmInit();
    expect(result.status).toBe("pass");
    const account = new v.Account();
    const keys = JSON.parse(account.identityKeys()) as { curve25519: string; ed25519: string };
    // The binding emits standard (not URL-safe) base64, unpadded.
    expect(keys.curve25519).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(keys.ed25519).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    account.free();
  });
});

/* ------------------------------------------------------------------ *
 * 2 + 3. Olm establishment and round-trip                            *
 * ------------------------------------------------------------------ */

describe("2/3. Olm session establishment + encrypt/decrypt", () => {
  it("completes the prekey handshake and round-trips plaintext in both directions", () => {
    const canary = "UNITTEST-CANARY-plaintext-🎉";
    const alice = createAccount(v);
    const bob = createAccount(v);
    publishBundle(alice, 1);
    const bobBundle = publishBundle(bob, 1);

    const est = establishOlmSession(v, alice, bob, bobBundle, canary);

    // Receiver decrypted the sender's first message.
    expect(est.firstPlaintext).toBe(canary);
    // Sender identity embedded in the prekey message matches Alice.
    const aliceBundle = JSON.parse(alice.identityKeys()) as { curve25519: string };
    expect(est.senderIdentityKey).toBe(aliceBundle.curve25519);
    // First message is a PreKey message (type 0).
    expect(est.firstMessage.type).toBe(0);

    // Bob -> Alice reply.
    const reply = olmEncrypt(est.inbound, "reply-1");
    expect(olmDecrypt(est.outbound, reply)).toBe("reply-1");

    // Alice -> Bob follow-up is a Normal message (type 1).
    const follow = olmEncrypt(est.outbound, "follow-2");
    expect(follow.type).toBe(1);
    expect(olmDecrypt(est.inbound, follow)).toBe("follow-2");
  });

  it("ratchets: distinct ciphertexts for identical plaintexts", () => {
    const alice = createAccount(v);
    const bob = createAccount(v);
    publishBundle(alice, 1);
    const bobBundle = publishBundle(bob, 1);
    const est = establishOlmSession(v, alice, bob, bobBundle, "seed");
    const m1 = olmEncrypt(est.outbound, "same");
    const m2 = olmEncrypt(est.outbound, "same");
    expect(m1.body).not.toBe(m2.body);
    expect(olmDecrypt(est.inbound, m1)).toBe("same");
    expect(olmDecrypt(est.inbound, m2)).toBe("same");
  });
});

/* ------------------------------------------------------------------ *
 * 4. Tampered ciphertext must be rejected                            *
 * ------------------------------------------------------------------ */

describe("4. Tampered ciphertext rejection", () => {
  /**
   * Build ONE bidirectional session, move the sender into steady-state (type 1
   * / Normal) messages, and return a matched pair: a Normal message `valid`
   * and the receiver's `snapshot` pickle taken immediately before that message
   * — so restoring `snapshot` gives a session that can decrypt `valid`. Each
   * tamper/control attempt then restores a pristine copy. This matters: a
   * failed decrypt mutates ratchet state, and sharing/reusing a session across
   * attempts produced a false "no throw" during debugging (a pre-key session
   * reused across attempts), and pairing a message with the WRONG session's
   * pickle would fail for the wrong reason.
   */
  function steadyPair(plaintext: string) {
    const alice = createAccount(v);
    const bob = createAccount(v);
    publishBundle(alice, 1);
    const bobBundle = publishBundle(bob, 1);
    const est = establishOlmSession(v, alice, bob, bobBundle, "seed");
    // Receiver replies; sender decrypts it, so the sender's next message is Normal.
    const reply = olmEncrypt(est.inbound, "bob-hello");
    olmDecrypt(est.outbound, reply);
    const snapshot = est.inbound.pickle();
    const valid = olmEncrypt(est.outbound, plaintext);
    return { valid, snapshot };
  }

  it("rejects a single-bit flip with a MAC (authentication) failure, control still decrypts", () => {
    const { valid, snapshot } = steadyPair("tamper-target");
    expect(valid.type).toBe(1); // steady-state Normal message, not PreKey

    // Control on a fresh copy: untampered message decrypts.
    const controlSession = v.Session.fromPickle(snapshot);
    expect(olmDecrypt(controlSession, valid)).toBe("tamper-target");
    controlSession.free();

    // Tamper on a separate fresh copy: must fail specifically the MAC check.
    const tamperSession = v.Session.fromPickle(snapshot);
    let err: unknown = null;
    try {
      olmDecrypt(tamperSession, { type: valid.type, body: flipByte(valid.body, 5) });
    } catch (e) {
      err = e;
    }
    tamperSession.free();
    expect(err).not.toBeNull();
    // Guard against a false pass: the rejection must be authentication, not
    // a malformed-base64/format error.
    expect(isOlmMacFailure(err)).toBe(true);
    expect(errorText(err)).toMatch(/MAC/i);
  });

  it("rejects flips everywhere: framing bytes fail decode, payload bytes fail the MAC", () => {
    const { valid, snapshot } = steadyPair("scan-me");
    const bodyLen = valid.body.length;

    // Every byte offset must be rejected (no flip ever decrypts). Olm messages
    // are Protobuf-framed: offset 0 is the version byte, offsets 1-2 are the
    // framing, and offset >= 3 is the authenticated payload (ratchet key,
    // counter, ciphertext, MAC). Offsets 0-2 are therefore rejected by the
    // version/decode checks BEFORE the MAC runs; from offset 3 on, rejection
    // is the MAC check.
    const sample = [0, 1, 2, 3, Math.floor(bodyLen / 2), bodyLen - 9, bodyLen - 1].filter(
      (o, i, a) => o >= 0 && o < bodyLen && a.indexOf(o) === i,
    );
    for (const offset of sample) {
      const session = v.Session.fromPickle(snapshot);
      let err: unknown = null;
      try {
        olmDecrypt(session, { type: valid.type, body: flipByte(valid.body, offset) });
      } catch (e) {
        err = e;
      }
      session.free();
      expect(err, `offset ${offset} must reject`).not.toBeNull();
    }

    // The authenticated payload (offset >= 3) must fail specifically the MAC
    // check — proving authentication runs and is what rejects tampering.
    for (const offset of [3, Math.floor(bodyLen / 2), bodyLen - 1]) {
      const session = v.Session.fromPickle(snapshot);
      let err: unknown = null;
      try {
        olmDecrypt(session, { type: valid.type, body: flipByte(valid.body, offset) });
      } catch (e) {
        err = e;
      }
      session.free();
      expect(isOlmMacFailure(err), `payload offset ${offset} should be a MAC failure`).toBe(true);
    }
  });

  it("rejects a tampered prekey message during session creation", () => {
    const alice = createAccount(v);
    const bob = createAccount(v);
    publishBundle(alice, 1);
    const bobBundle = publishBundle(bob, 1);
    const target = Object.values(bobBundle.oneTimeKeys)[0];
    const outbound = alice.createOutboundSession(bobBundle.curve25519IdentityKey, target);
    const prekey = JSON.parse(outbound.encrypt("first")) as { type: number; body: string };
    expect(prekey.type).toBe(0);
    const tamperedBody = flipByte(prekey.body, 7);
    let err: unknown = null;
    try {
      bob.createInboundSession(tamperedBody);
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeNull();
    expect(errorText(err)).toBeTruthy();
  });

  it("rejects a single-bit flip in a Megolm body with an authenticity/format failure", () => {
    const meg = megolmRoundTrip(v, "megolm-tamper");
    let err: unknown = null;
    try {
      meg.inbound.decrypt(flipByte(meg.body, 10));
    } catch (e) {
      err = e;
    }
    expect(err).not.toBeNull();
    expect(isMegolmRejection(err)).toBe(true);
    // Control: the untampered body still decrypts.
    const out = JSON.parse(meg.inbound.decrypt(meg.body)) as { plaintext: string };
    expect(out.plaintext).toBe("megolm-tamper");
  });
});

/* ------------------------------------------------------------------ *
 * 7. Megolm encryption/decryption + export boundary                  *
 * ------------------------------------------------------------------ */

describe("7. Megolm round trip and export-at-index boundary", () => {
  it("encrypts and decrypts with correct index tracking", () => {
    const meg = megolmRoundTrip(v, "hello megolm 🎉");
    expect(meg.decrypted).toBe("hello megolm 🎉");
    expect(meg.decryptedIndex).toBe(0);
    expect(meg.nextIndex).toBe(1);
  });

  it("enforces the export-at-index boundary", () => {
    const outbound = new v.GroupSession();
    const sessionKey = outbound.sessionKey(); // captured at index 0
    const plaintexts = ["m0", "m1", "m2", "m3"];
    const bodies = megolmEncryptMany(outbound, plaintexts);

    const boundary = megolmExportBoundary(v, sessionKey, bodies, 2);
    expect(boundary.exported).toBe(true);
    expect(boundary.fromIndexRejectedEarlierMessage).toBe(true);
    expect(boundary.fromIndexDecryptedTargetMessage).toBe(true);
  });
});

/* ------------------------------------------------------------------ *
 * 5 + 6. Persistence, restore, and continued operation               *
 * ------------------------------------------------------------------ */

describe("5/6. Sealed persistence + continued operation", () => {
  it("seals pickles, restores fresh objects from IndexedDB, and keeps ratcheting", async () => {
    const {
      runPhase1,
      saveState,
      loadAndContinue,
    } = await import("@/lib/spike/run");

    const canary = "PERSIST-CANARY";
    const { steps: p1, ctx } = await runPhase1(canary);
    expect(p1.every((s) => s.status === "pass")).toBe(true);
    expect(ctx).not.toBeNull();

    const saveResult = await saveState(ctx!);
    expect(saveResult.status).toBe("pass");

    // The store must contain only sealed envelopes, no raw key material.
    const { auditNoPlaintextKeys, getSealed } = await import("@/lib/spike/store");
    const offending = await auditNoPlaintextKeys();
    expect(offending).toEqual([]);

    // Spot-check one record: it is {v,iv,ct}, and its ciphertext does not
    // contain the plaintext canary.
    const aliceAccountRecord = await getSealed("spike:alice-account");
    expect(aliceAccountRecord).not.toBeNull();
    expect(aliceAccountRecord!.v).toBe(1);
    expect(JSON.stringify(aliceAccountRecord)).not.toContain(canary);
    expect(JSON.stringify(aliceAccountRecord)).not.toContain("signing_key");

    // Restore into fresh objects (simulates post-reload) and continue.
    const postCanary = "POST-RELOAD-CANARY";
    const { steps: restoredSteps, restored } = await loadAndContinue(v, postCanary);
    expect(restoredSteps.every((s) => s.status === "pass")).toBe(true);
    expect(restored).not.toBeNull();

    // 6. Continued operation: new messages on restored sessions both ways.
    const m = olmEncrypt(restored!.aliceSession, "after-restore");
    expect(olmDecrypt(restored!.bobSession, m)).toBe("after-restore");
    const r = olmEncrypt(restored!.bobSession, "back-at-you");
    expect(olmDecrypt(restored!.aliceSession, r)).toBe("back-at-you");
  });

  it("rejects a tampered sealed envelope (AES-GCM auth)", async () => {
    const { seal, unseal } = await import("@/lib/spike/store");
    const env = await seal("secret-pickle-material");
    // Flip a bit in the ciphertext.
    const ct = Buffer.from(env.ct, "base64");
    ct[0] ^= 0x01;
    const tampered = { ...env, ct: ct.toString("base64") };
    await expect(unseal(tampered)).rejects.toThrow();
  });
});

/* ------------------------------------------------------------------ *
 * 8. No outbound network traffic carries plaintext                   *
 * ------------------------------------------------------------------ */

describe("8. No plaintext in outbound network requests", () => {
  it("the crypto code path performs zero fetch() calls during a full run", async () => {
    const calls: string[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = ((...args: unknown[]) => {
      calls.push(JSON.stringify(args).slice(0, 200));
      return Promise.reject(new Error("network disabled during spike test"));
    }) as typeof fetch;

    try {
      const { runPhase1, saveState, loadAndContinue } = await import("@/lib/spike/run");
      const { ctx } = await runPhase1("NET-CANARY");
      expect(ctx).not.toBeNull();
      await saveState(ctx!);
      await loadAndContinue(v, "NET-CANARY-2");
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(calls).toEqual([]);
  });
});

/* ------------------------------------------------------------------ *
 * 9. No secrets in console output                                     *
 * ------------------------------------------------------------------ */

describe("9. No private keys or secrets in application logs", () => {
  it("a full run emits no console output containing key material or plaintext", async () => {
    const captured: string[] = [];
    const methods = ["log", "info", "warn", "error", "debug"] as const;
    const originals = methods.map((m) => console[m]);
    for (const m of methods) {
      console[m] = (...args: unknown[]) => {
        captured.push(args.map((a) => (typeof a === "string" ? a : JSON.stringify(a))).join(" "));
      };
    }
    let ctx = null;
    try {
      const { runPhase1 } = await import("@/lib/spike/run");
      ctx = (await runPhase1("LOG-CANARY")).ctx;
    } finally {
      methods.forEach((m, i) => {
        console[m] = originals[i];
      });
    }
    expect(ctx).not.toBeNull();

    const alicePickle = ctx!.alice.pickle();
    const joined = captured.join("\n");
    // No full pickle, no raw key markers, no canary plaintext in any log line.
    expect(joined).not.toContain("signing_key");
    expect(joined).not.toContain(alicePickle.slice(0, 40));
    expect(joined).not.toContain("LOG-CANARY");
  });
});

/* ------------------------------------------------------------------ *
 * 10. Vendored Megolm vectors (author-generated, not official KATs)  *
 * ------------------------------------------------------------------ */

describe("10. Vendored Megolm vectors (binding-author-generated)", () => {
  const require = createRequire(import.meta.url);
  const vectors = JSON.parse(
    readFileSync(new URL("./vectors/megolm-v1.json", import.meta.url), "utf8"),
  ) as {
    megolmVersion: number;
    sessionId: string;
    sessionKey: string;
    exportedAtIndex2: string;
    inboundPickle: string;
    messages: { index: number; plaintext: string; ciphertext: string }[];
  };

  it("matches the recorded session id", () => {
    const inbound = new v.InboundGroupSession(vectors.sessionKey);
    expect(inbound.sessionId()).toBe(vectors.sessionId);
    void require;
  });

  it("decrypts every recorded message at the recorded index", () => {
    const inbound = new v.InboundGroupSession(vectors.sessionKey);
    for (const m of vectors.messages) {
      const out = JSON.parse(inbound.decrypt(m.ciphertext)) as {
        plaintext: string;
        messageIndex: number;
      };
      expect(out.plaintext).toBe(m.plaintext);
      expect(out.messageIndex).toBe(m.index);
    }
  });

  it("honors the recorded export-at-2 boundary", () => {
    const imported = v.InboundGroupSession.import(vectors.exportedAtIndex2);
    expect(imported.firstKnownIndex()).toBe(2);
    const below = vectors.messages.find((m) => m.index < 2)!;
    expect(() => imported.decrypt(below.ciphertext)).toThrow();
    const at2 = vectors.messages.find((m) => m.index === 2)!;
    const out = JSON.parse(imported.decrypt(at2.ciphertext)) as { plaintext: string };
    expect(out.plaintext).toBe(at2.plaintext);
  });

  it("restores from the recorded inbound pickle", () => {
    const restored = v.InboundGroupSession.fromPickle(vectors.inboundPickle);
    expect(restored.sessionId()).toBe(vectors.sessionId);
  });
});
