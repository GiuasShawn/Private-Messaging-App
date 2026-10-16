/**
 * Thin, typed wrappers over the vodozemac binding API for the spike.
 *
 * Only methods verified to exist in @kinsh/vodozemac-wasm@0.4.2's .d.ts are
 * used. Olm message envelopes are {type, body} JSON strings produced by
 * Session.encrypt(); Megolm messages are raw base64 body strings.
 *
 * Security posture: test identities and test plaintext only. No production
 * key management, no device enrollment, no replay protection — those are
 * Phase 2+ concerns and are listed in BLOCKERS.md.
 */

import type {
  Account,
  GroupSession,
  InboundGroupSession,
  Session,
} from "@kinsh/vodozemac-wasm";
import type { Vodozemac } from "./wasm";

export interface OlmMessage {
  type: 0 | 1; // 0 = PreKey, 1 = Normal
  body: string;
}

export interface DevicePublicBundle {
  /** Curve25519 identity key (base64). */
  curve25519IdentityKey: string;
  /** Ed25519 signing key (base64). */
  ed25519IdentityKey: string;
  /** Unpublished one-time keys: keyId -> curve25519 public key. */
  oneTimeKeys: Record<string, string>;
  /** Fallback (server-held prekey) public key, if any. */
  fallbackKey: { keyId: string; publicKey: string } | null;
}

export function createAccount(v: Vodozemac): Account {
  return new v.Account();
}

/** Extract and publish the public half of an account for the "server". */
export function publishBundle(account: Account, oneTimeKeyCount = 1): DevicePublicBundle {
  if (oneTimeKeyCount > 0) {
    account.generateOneTimeKeys(oneTimeKeyCount);
  }
  account.generateFallbackKey();

  const identity = JSON.parse(account.identityKeys()) as {
    curve25519: string;
    ed25519: string;
  };
  const otkJson = JSON.parse(account.oneTimeKeys()) as {
    curve25519?: Record<string, string>;
  };
  const fbJson = JSON.parse(account.fallbackKey()) as {
    curve25519?: Record<string, string>;
  };
  const fallbackEntries = Object.entries(fbJson.curve25519 ?? {});
  const fallbackKey =
    fallbackEntries.length > 0
      ? { keyId: fallbackEntries[0][0], publicKey: fallbackEntries[0][1] }
      : null;

  // Keys are now "published"; prevent accidental double-publish.
  account.markKeysAsPublished();

  return {
    curve25519IdentityKey: identity.curve25519,
    ed25519IdentityKey: identity.ed25519,
    oneTimeKeys: { ...(otkJson.curve25519 ?? {}) },
    fallbackKey,
  };
}

/** Take the first available one-time key, else the fallback key. */
function pickKeyForOutbound(bundle: DevicePublicBundle): {
  keyId: string;
  publicKey: string;
  kind: "one-time" | "fallback";
} {
  const otk = Object.entries(bundle.oneTimeKeys)[0];
  if (otk) return { keyId: otk[0], publicKey: otk[1], kind: "one-time" };
  if (bundle.fallbackKey)
    return {
      keyId: bundle.fallbackKey.keyId,
      publicKey: bundle.fallbackKey.publicKey,
      kind: "fallback",
    };
  throw new Error("peer bundle has no one-time or fallback keys");
}

export interface EstablishedOlm {
  /** Sender-side session (Alice). */
  outbound: Session;
  /** The first (prekey) message, as it would travel through the server. */
  firstMessage: OlmMessage;
  /** Sender identity key extracted from the prekey message by the receiver. */
  senderIdentityKey: string;
  /** Receiver-side session (Bob), created from the prekey message. */
  inbound: Session;
  /** Plaintext of the first message, decrypted on the receiving side. */
  firstPlaintext: string;
  /** Which key type the outbound session consumed. */
  usedKeyKind: "one-time" | "fallback";
}

/**
 * Full handshake on the documented binding API:
 *  1. sender.createOutboundSession(theirIdentityKey, oneTimeKey) -> Session
 *  2. outbound.encrypt(plaintext) -> PreKey message {type:0, body}
 *  3. receiver.createInboundSession(body) -> InboundResult{plaintext,
 *     senderIdentityKey, takeSession()}
 */
export function establishOlmSession(
  v: Vodozemac,
  sender: Account,
  receiver: Account,
  receiverBundle: DevicePublicBundle,
  firstPlaintext: string,
): EstablishedOlm {
  const target = pickKeyForOutbound(receiverBundle);
  const outbound = sender.createOutboundSession(
    receiverBundle.curve25519IdentityKey,
    target.publicKey,
  );
  const raw = JSON.parse(outbound.encrypt(firstPlaintext)) as OlmMessage;
  if (raw.type !== 0) {
    throw new Error(`expected first message to be PreKey (0), got ${raw.type}`);
  }

  // The receiver's account creates the inbound session from the prekey
  // body; the binding extracts the sender identity key from the message.
  const result = receiver.createInboundSession(raw.body);
  const inbound = result.takeSession();

  return {
    outbound,
    firstMessage: raw,
    senderIdentityKey: result.senderIdentityKey,
    inbound,
    firstPlaintext: result.plaintext,
    usedKeyKind: target.kind,
  };
}

/**
 * Extract a readable message from a thrown value. The wasm-bindgen glue
 * throws raw strings (JsValue), NOT Error instances, so `err.message` is
 * undefined for library errors. Handle both.
 */
export function errorText(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return String(err);
}

/**
 * True when an Olm decrypt failure is specifically the message-authentication
 * check (MAC) rather than a malformed/undecodable message. Used so tamper
 * tests fail loudly if a flip is ever rejected for the wrong reason (e.g. an
 * accidental base64-alphabet mismatch), which would make the test pass without
 * proving authentication actually runs.
 */
export function isOlmMacFailure(err: unknown): boolean {
  return /\bMAC\b/i.test(errorText(err));
}

/** True when a Megolm rejection is an authenticity/format failure (any rejection is a pass). */
export function isMegolmRejection(err: unknown): boolean {
  const t = errorText(err);
  return /signature|protobuf|version|invalid|decode/i.test(t);
}

export function olmEncrypt(session: Session, plaintext: string): OlmMessage {
  return JSON.parse(session.encrypt(plaintext)) as OlmMessage;
}

export function olmDecrypt(session: Session, msg: OlmMessage): string {
  return session.decrypt(msg.type, msg.body);
}

/* ------------------------------------------------------------------ *
 * Base64 helpers.                                                     *
 * NOTE: @kinsh/vodozemac-wasm@0.4.2 emits STANDARD base64 (with + and  *
 * /) and does NOT pad — verified empirically against identityKeys(),   *
 * Session.encrypt() bodies, and by a tamper test that initially failed *
 * because a URL-safe re-encode was rejected as malformed base64        *
 * ("Invalid symbol 45") rather than failing the MAC. We therefore      *
 * decode leniently (accept both alphabets) but always re-encode to     *
 * the SAME standard, unpadded alphabet the library produces so a       *
 * single-bit flip yields a valid base64 message that must fail the     *
 * message-authentication check.                                        *
 * ------------------------------------------------------------------ */

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  // Accept both standard and URL-safe alphabets on decode.
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const padded = norm + "=".repeat((4 - (norm.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Re-encode to standard, unpadded base64 — matching the library's output. */
export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/=+$/, "");
}

/**
 * Flip one bit in a message body at the given offset (wrapping), returning a
 * new body that differs from the original by exactly one byte and remains
 * valid standard base64.
 */
export function flipByte(b64: string, offset: number): string {
  const bytes = b64ToBytes(b64);
  if (bytes.length === 0) throw new Error("empty message body");
  const idx = ((offset % bytes.length) + bytes.length) % bytes.length;
  bytes[idx] ^= 0x01;
  return bytesToB64(bytes);
}

/* ------------------------------------------------------------------ *
 * Megolm wrappers                                                    *
 * ------------------------------------------------------------------ */

export interface MegolmRoundTrip {
  outbound: GroupSession;
  inbound: InboundGroupSession;
  sessionId: string;
  /** Ratchet index of the *next* message after encrypting one. */
  nextIndex: number;
  decrypted: string;
  decryptedIndex: number;
  /** The raw ciphertext body, kept for tamper tests. */
  body: string;
  /** Session key at index 0, for building a second inbound session. */
  sessionKey: string;
}

export function megolmRoundTrip(v: Vodozemac, plaintext: string): MegolmRoundTrip {
  const outbound = new v.GroupSession();
  const sessionKey = outbound.sessionKey();
  const inbound = new v.InboundGroupSession(sessionKey);
  const body = outbound.encrypt(plaintext);
  const parsed = JSON.parse(inbound.decrypt(body)) as {
    plaintext: string;
    messageIndex: number;
  };
  return {
    outbound,
    inbound,
    sessionId: outbound.sessionId(),
    nextIndex: outbound.messageIndex(),
    decrypted: parsed.plaintext,
    decryptedIndex: parsed.messageIndex,
    body,
    sessionKey,
  };
}

export interface ExportBoundaryResult {
  exported: boolean;
  fromIndexRejectedEarlierMessage: boolean;
  fromIndexDecryptedTargetMessage: boolean;
}

/**
 * Verify the export-at-index semantics: a session imported from a key
 * exported at index N must reject messages below N and decrypt at/above N.
 *
 * `sessionKeyAtIndex0` must be the key captured from `GroupSession.sessionKey()`
 * *before* any message was encrypted — session keys carry the ratchet index
 * they were minted at.
 */
export function megolmExportBoundary(
  v: Vodozemac,
  sessionKeyAtIndex0: string,
  bodies: string[],
  exportIndex: number,
): ExportBoundaryResult {
  // Rebuild an inbound session from scratch so ratchet state is pristine.
  const full = new v.InboundGroupSession(sessionKeyAtIndex0);
  const exported = full.exportAt(exportIndex);
  if (!exported) {
    return {
      exported: false,
      fromIndexRejectedEarlierMessage: false,
      fromIndexDecryptedTargetMessage: false,
    };
  }
  const imported = v.InboundGroupSession.import(exported);

  let earlierRejected = true;
  if (exportIndex > 0) {
    try {
      imported.decrypt(bodies[0]);
      earlierRejected = false;
    } catch {
      earlierRejected = true;
    }
  }

  let targetDecrypted = false;
  try {
    const out = JSON.parse(imported.decrypt(bodies[exportIndex])) as {
      plaintext: string;
    };
    targetDecrypted = typeof out.plaintext === "string";
  } catch {
    targetDecrypted = false;
  }

  return {
    exported: true,
    fromIndexRejectedEarlierMessage: earlierRejected,
    fromIndexDecryptedTargetMessage: targetDecrypted,
  };
}

/** Encrypt several messages and return their bodies. */
export function megolmEncryptMany(
  outbound: GroupSession,
  plaintexts: string[],
): string[] {
  return plaintexts.map((p) => outbound.encrypt(p));
}
