/**
 * Step orchestration for the Phase 0.5 spike.
 *
 * The SAME functions run in two contexts:
 *   - the browser page /spike (UI + real IndexedDB + real network watch), and
 *   - Vitest (Node, fake-indexeddb, fetch/console instrumentation).
 * Keeping one implementation means the automated tests exercise the exact
 * logic the page ships.
 *
 * Nothing here talks to a remote service. Test identities and test plaintext
 * only.
 */

import type { Account, Session, GroupSession, InboundGroupSession } from "@kinsh/vodozemac-wasm";
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
  type DevicePublicBundle,
  type EstablishedOlm,
} from "./crypto";
import { loadCrypto, type Vodozemac } from "./wasm";
import { seal, unseal, putSealed, getSealed, type SealedEnvelope } from "./store";

export type StepStatus = "pass" | "fail" | "skipped";

export interface StepResult {
  id: string;
  label: string;
  status: StepStatus;
  detail: string;
}

export interface PersistedSpikeState {
  aliceAccountPickle: SealedEnvelope;
  bobAccountPickle: SealedEnvelope;
  aliceSessionPickle: SealedEnvelope;
  bobSessionPickle: SealedEnvelope;
  megolmOutboundPickle: SealedEnvelope;
  megolmInboundPickle: SealedEnvelope;
  meta: {
    aliceIdentity: DevicePublicBundle;
    bobIdentity: DevicePublicBundle;
    savedAt: string;
  };
}

const KEYS = {
  aliceAccount: "spike:alice-account",
  bobAccount: "spike:bob-account",
  aliceSession: "spike:alice-session",
  bobSession: "spike:bob-session",
  megOut: "spike:megolm-outbound",
  megIn: "spike:megolm-inbound",
  bundle: "spike:public-bundles",
} as const;

/* ------------------------------------------------------------------ *
 * Phase 1: fresh handshake + tamper + megolm (no persistence)        *
 * ------------------------------------------------------------------ */

export interface SpikeRunContext {
  v: Vodozemac;
  alice: Account;
  bob: Account;
  aliceBundle: DevicePublicBundle;
  bobBundle: DevicePublicBundle;
  established: EstablishedOlm;
  canary: string;
  meg: ReturnType<typeof megolmRoundTrip>;
}

function pass(id: string, label: string, detail: string): StepResult {
  return { id, label, status: "pass", detail };
}
function fail(id: string, label: string, detail: string): StepResult {
  return { id, label, status: "fail", detail };
}

/** A is trivially satisfied when loadCrypto() resolves; kept for the log. */
export async function stepA_wasmInit(): Promise<{ result: StepResult; v: Vodozemac }> {
  try {
    const v = await loadCrypto();
    // Prove the module is live by minting and dropping an account.
    const probe = new v.Account();
    const keys = JSON.parse(probe.identityKeys()) as { curve25519: string };
    probe.free();
    if (!keys.curve25519) throw new Error("identityKeys returned no curve25519 key");
    return {
      result: pass("A", "WASM initialization", "module loaded; Account minted a valid identity"),
      v,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      result: fail("A", "WASM initialization", message),
      v: undefined as unknown as Vodozemac,
    };
  }
}

/** B: two identities -> prekey exchange -> decrypt on receiver. */
export function stepB_olmEstablish(
  v: Vodozemac,
  canary: string,
): { result: StepResult; ctx: Partial<SpikeRunContext> } {
  try {
    const alice = createAccount(v);
    const bob = createAccount(v);
    const aliceBundle = publishBundle(alice, 1);
    const bobBundle = publishBundle(bob, 1);

    const established = establishOlmSession(v, alice, bob, bobBundle, canary);

    if (established.firstPlaintext !== canary) {
      return {
        result: fail("B", "Olm session establishment", "decrypted plaintext did not match canary"),
        ctx: {},
      };
    }
    const checks = ["plaintext matched"];
    if (established.senderIdentityKey !== aliceBundle.curve25519IdentityKey) {
      return {
        result: fail(
          "B",
          "Olm session establishment",
          "sender identity key in prekey message did not match sender's published identity",
        ),
        ctx: {},
      };
    }
    checks.push("sender identity key verified");
    checks.push(`key type: ${established.usedKeyKind}`);

    // Round-trip a reply back (receiver -> sender) to prove both directions.
    const reply = olmEncrypt(established.inbound, "ack:" + canary);
    const replyPlain = olmDecrypt(established.outbound, reply);
    if (replyPlain !== "ack:" + canary) {
      return {
        result: fail("B", "Olm session establishment", "reverse direction decrypt failed"),
        ctx: {},
      };
    }
    checks.push("reverse direction ok");

    return {
      result: pass("B", "Olm session establishment", checks.join("; ")),
      ctx: { alice, bob, aliceBundle, bobBundle, established, canary },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { result: fail("B", "Olm session establishment", message), ctx: {} };
  }
}

// establishOlmSession needs the receiver Account to call createInboundSession
// on. We keep the signature honest by passing it directly.

/** C: flip one bit in a valid message; decryption must fail the MAC check. */
export function stepC_tamper(v: Vodozemac, ctx: SpikeRunContext): StepResult {
  try {
    // Snapshot the receiver session so control and tamper attempts each run
    // on a pristine copy — a failed decrypt mutates ratchet state, so sharing
    // one session would make the control dependent on the tamper attempt.
    const snapshot = ctx.established.inbound.pickle();

    // Make a steady-state (type 1) message: the sender already received a
    // reply in step B, so this is a Normal message, not a PreKey one.
    const valid = olmEncrypt(ctx.established.outbound, "tamper-target");

    // CONTROL on a fresh copy: the untampered message must decrypt.
    const controlSession = v.Session.fromPickle(snapshot);
    let controlPlain = "";
    try {
      controlPlain = olmDecrypt(controlSession, valid);
    } catch (err) {
      controlSession.free();
      return fail(
        "C",
        "Tamper rejection",
        `control message failed to decrypt: ${errorText(err)}`,
      );
    }
    controlSession.free();
    if (controlPlain !== "tamper-target") {
      return fail("C", "Tamper rejection", "control plaintext mismatch");
    }

    // TAMPER on a separate fresh copy: one-bit flip must be rejected, and
    // specifically by the message-authentication check — not by a decode or
    // format error, which would mean we aren't actually proving auth runs.
    const tamperSession = v.Session.fromPickle(snapshot);
    let tamperError: unknown = null;
    let tamperAccepted = false;
    try {
      olmDecrypt(tamperSession, { type: valid.type, body: flipByte(valid.body, 5) });
      tamperAccepted = true;
    } catch (err) {
      tamperError = err;
    }
    tamperSession.free();
    if (tamperAccepted) {
      return fail("C", "Tamper rejection", "tampered Olm ciphertext was accepted");
    }
    if (!isOlmMacFailure(tamperError)) {
      return fail(
        "C",
        "Tamper rejection",
        `tamper rejected for a NON-authentication reason (test would be inconclusive): ${errorText(tamperError)}`,
      );
    }

    // MEGOLM tamper: a mid-body flip must also be rejected (Megolm authenticates
    // with an Ed25519 signature over the message, plus a protobuf framing).
    let megError: unknown = null;
    let megAccepted = false;
    try {
      ctx.meg.inbound.decrypt(flipByte(ctx.meg.body, 10));
      megAccepted = true;
    } catch (err) {
      megError = err;
    }
    if (megAccepted) {
      return fail("C", "Tamper rejection", "tampered Megolm ciphertext was accepted");
    }
    if (!isMegolmRejection(megError)) {
      return fail(
        "C",
        "Tamper rejection",
        `Megolm tamper rejected for an unrecognized reason: ${errorText(megError)}`,
      );
    }

    return pass(
      "C",
      "Tamper rejection",
      `Olm rejected via MAC check ("${shorten(errorText(tamperError))}"); ` +
        `Megolm rejected ("${shorten(errorText(megError))}"); control still decrypted`,
    );
  } catch (err) {
    return fail("C", "Tamper rejection", errorText(err));
  }
}

function shorten(s: string): string {
  return s.length > 120 ? s.slice(0, 117) + "..." : s;
}

/** E: Megolm round trip + export-at-index boundary. */
export function stepE_megolm(v: Vodozemac, canary: string): {
  result: StepResult;
  meg: SpikeRunContext["meg"] | null;
} {
  try {
    const meg = megolmRoundTrip(v, `megolm:${canary}`);
    const checks: string[] = [];
    if (meg.decrypted !== `megolm:${canary}`) {
      return { result: fail("E", "Megolm round trip", "plaintext mismatch"), meg: null };
    }
    checks.push("round trip ok");
    if (meg.decryptedIndex !== 0) {
      return {
        result: fail("E", "Megolm round trip", `expected index 0, got ${meg.decryptedIndex}`),
        meg: null,
      };
    }
    checks.push("index tracked");

    // Export boundary: encrypt 4 messages, export at 2, earlier must fail.
    const plaintexts = ["m0", "m1", "m2", "m3"];
    const bodies = megolmEncryptMany(meg.outbound, plaintexts);
    const boundary = megolmExportBoundary(v, meg.sessionKey, bodies, 2);
    if (!boundary.exported) {
      return { result: fail("E", "Megolm round trip", "exportAt(2) returned nothing"), meg: null };
    }
    checks.push("exportAt(2) produced a key");
    if (!boundary.fromIndexRejectedEarlierMessage) {
      return {
        result: fail("E", "Megolm round trip", "imported-at-2 session decrypted an index-0 message"),
        meg: null,
      };
    }
    checks.push("index<2 rejected on imported session");
    if (!boundary.fromIndexDecryptedTargetMessage) {
      return {
        result: fail("E", "Megolm round trip", "imported-at-2 session failed to decrypt index-2"),
        meg: null,
      };
    }
    checks.push("index>=2 decrypts on imported session");

    return { result: pass("E", "Megolm round trip", checks.join("; ")), meg };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { result: fail("E", "Megolm round trip", message), meg: null };
  }
}

/** Run phases A, B, E, C in order. Returns full context for persistence. */
export async function runPhase1(canary: string): Promise<{
  steps: StepResult[];
  ctx: SpikeRunContext | null;
}> {
  const steps: StepResult[] = [];
  const { result: aResult, v } = await stepA_wasmInit();
  steps.push(aResult);
  if (aResult.status !== "pass") return { steps, ctx: null };

  const b = stepB_olmEstablish(v, canary);
  steps.push(b.result);
  if (b.result.status !== "pass") return { steps, ctx: null };

  const e = stepE_megolm(v, canary);
  steps.push(e.result);
  if (!e.meg) return { steps, ctx: null };

  const ctx: SpikeRunContext = { v, ...b.ctx, meg: e.meg } as SpikeRunContext;
  const c = stepC_tamper(v, ctx);
  steps.push(c);
  if (c.status !== "pass") return { steps, ctx: null };

  return { steps, ctx };
}

/* ------------------------------------------------------------------ *
 * Phase 2: persistence across "reload"                               *
 * ------------------------------------------------------------------ */

/**
 * Seal and store the minimum state needed to continue: both accounts and
 * both Olm sessions (plus Megolm sessions). Every pickle goes through
 * seal() first; raw pickle strings are never handed to the store.
 */
export async function saveState(ctx: SpikeRunContext): Promise<StepResult> {
  try {
    const [aliceAccount, bobAccount, aliceSession, bobSession, megOut, megIn] = await Promise.all([
      seal(ctx.alice.pickle()),
      seal(ctx.bob.pickle()),
      seal(ctx.established.outbound.pickle()),
      seal(ctx.established.inbound.pickle()),
      seal(ctx.meg.outbound.pickle()),
      seal(ctx.meg.inbound.pickle()),
    ]);

    await Promise.all([
      putSealed(KEYS.aliceAccount, aliceAccount),
      putSealed(KEYS.bobAccount, bobAccount),
      putSealed(KEYS.aliceSession, aliceSession),
      putSealed(KEYS.bobSession, bobSession),
      putSealed(KEYS.megOut, megOut),
      putSealed(KEYS.megIn, megIn),
      putSealed(
        KEYS.bundle,
        await seal(
          JSON.stringify({
            aliceIdentity: ctx.aliceBundle,
            bobIdentity: ctx.bobBundle,
            savedAt: new Date().toISOString(),
          }),
        ),
      ),
    ]);

    // Post-condition: nothing readable in the store resembles key material.
    const { auditNoPlaintextKeys } = await import("./store");
    const offending = await auditNoPlaintextKeys();
    if (offending.length > 0) {
      return fail("D1", "Persist sealed state", offending.join("; "));
    }
    return pass(
      "D1",
      "Persist sealed state",
      "6 sealed records written; envelope audit found no plaintext key markers",
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail("D1", "Persist sealed state", message);
  }
}

export interface RestoredState {
  alice: Account;
  bob: Account;
  aliceSession: Session;
  bobSession: Session;
  megOut: GroupSession;
  megIn: InboundGroupSession;
  meta: PersistedSpikeState["meta"];
}

/**
 * Restore from sealed records into FRESH objects — the post-reload half of
 * the persistence test. Proves pickles round-trip through AES-GCM +
 * IndexedDB and that sessions keep ratcheting afterwards.
 */
export async function loadAndContinue(
  v: Vodozemac,
  continuationCanary: string,
): Promise<{ steps: StepResult[]; restored: RestoredState | null }> {
  const steps: StepResult[] = [];
  try {
    const [
      aliceAccountEnv,
      bobAccountEnv,
      aliceSessionEnv,
      bobSessionEnv,
      megOutEnv,
      megInEnv,
      bundleEnv,
    ] = await Promise.all([
      getSealed(KEYS.aliceAccount),
      getSealed(KEYS.bobAccount),
      getSealed(KEYS.aliceSession),
      getSealed(KEYS.bobSession),
      getSealed(KEYS.megOut),
      getSealed(KEYS.megIn),
      getSealed(KEYS.bundle),
    ]);

    const required = [
      aliceAccountEnv,
      bobAccountEnv,
      aliceSessionEnv,
      bobSessionEnv,
      megOutEnv,
      megInEnv,
      bundleEnv,
    ];
    if (required.some((r) => r === null)) {
      steps.push(fail("D2", "Restore sealed state", "one or more sealed records missing"));
      return { steps, restored: null };
    }

    const [alicePickle, bobPickle, aliceSP, bobSP, megOutP, megInP, bundleP] = await Promise.all(
      required.map((env) => unseal(env as SealedEnvelope)),
    );

    const alice = v.Account.fromPickle(alicePickle);
    const bob = v.Account.fromPickle(bobPickle);
    const aliceSession = v.Session.fromPickle(aliceSP);
    const bobSession = v.Session.fromPickle(bobSP);
    const megOut = v.GroupSession.fromPickle(megOutP);
    const megIn = v.InboundGroupSession.fromPickle(megInP);
    const meta = JSON.parse(bundleP) as PersistedSpikeState["meta"];

    steps.push(
      pass(
        "D2",
        "Restore sealed state",
        "all six pickles unsealed and reconstructed into fresh objects",
      ),
    );

    // D3: continue the conversation on the restored session objects.
    const msg = olmEncrypt(aliceSession, continuationCanary);
    const decrypted = olmDecrypt(bobSession, msg);
    if (decrypted !== continuationCanary) {
      steps.push(fail("D3", "Continue after restore", "restored session failed to decrypt"));
      return { steps, restored: null };
    }
    // And the other direction.
    const reply = olmEncrypt(bobSession, "echo:" + continuationCanary);
    const replyPlain = olmDecrypt(aliceSession, reply);
    if (replyPlain !== "echo:" + continuationCanary) {
      steps.push(fail("D3", "Continue after restore", "restored reverse direction failed"));
      return { steps, restored: null };
    }
    steps.push(
      pass("D3", "Continue after restore", "both directions ratcheted on restored sessions"),
    );

    // D4: Megolm continuity — restored outbound keeps indexing upward.
    const before = megOut.messageIndex();
    const body = megOut.encrypt("post-restore megolm");
    const out = JSON.parse(megIn.decrypt(body)) as { plaintext: string; messageIndex: number };
    if (out.plaintext !== "post-restore megolm" || out.messageIndex !== before) {
      steps.push(fail("D4", "Megolm after restore", "index or plaintext mismatch"));
      return { steps, restored: null };
    }
    steps.push(
      pass("D4", "Megolm after restore", `ratchet continued at index ${out.messageIndex}`),
    );

    return {
      steps,
      restored: { alice, bob, aliceSession, bobSession, megOut, megIn, meta },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    steps.push(fail("D2", "Restore sealed state", message));
    return { steps, restored: null };
  }
}
