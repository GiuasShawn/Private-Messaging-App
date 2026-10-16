/**
 * Sealed persistence for the spike.
 *
 * The binding's pickle() returns PLAINTEXT JSON containing raw private keys
 * (verified empirically and stated in its source header: "at-rest encryption
 * is the application's responsibility"). We therefore AES-GCM-seal every
 * pickle with a local key before it touches IndexedDB, and only sealed
 * envelopes are ever written.
 *
 * Local key handling here is deliberately throwaway (spike-only): a random
 * 256-bit AES-GCM key generated on first use and stored in a dedicated
 * IndexedDB record *in raw form*. That protects against accidental
 * ciphertext leaks (backups, screenshots of IDB, sync) but NOT against an
 * attacker with persistent same-origin script execution — they could read
 * the key record too. Production key derivation/wrapping is Phase 4+
 * (see BLOCKERS.md).
 */

export const DB_NAME = "vodozemac-spike";
export const DB_VERSION = 1;
export const STORE_STATE = "sealed-state";
export const STORE_KEYS = "local-keys";
export const LOCAL_AES_KEY_ID = "spike-aes-key-v1";

export interface SealedEnvelope {
  /** Envelope format version. */
  v: 1;
  /** AES-GCM 128-bit IV, base64. */
  iv: string;
  /** Ciphertext, base64. */
  ct: string;
}

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(
      new Error("indexedDB unavailable in this runtime (expected in browser or fake-indexeddb)"),
    );
  }
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_STATE)) db.createObjectStore(STORE_STATE);
      if (!db.objectStoreNames.contains(STORE_KEYS)) db.createObjectStore(STORE_KEYS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("failed to open IndexedDB"));
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error("IndexedDB transaction failed"));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted"));
  });
}

// Memoized key promise so concurrent seal() calls share a single key
// generation instead of racing to write different keys on first run.
let aesKeyPromise: Promise<CryptoKey> | null = null;

function getOrCreateAesKey(): Promise<CryptoKey> {
  if (!aesKeyPromise) {
    aesKeyPromise = doGetOrCreateAesKey().catch((err) => {
      aesKeyPromise = null; // allow retry on failure
      throw err;
    });
  }
  return aesKeyPromise;
}

async function doGetOrCreateAesKey(): Promise<CryptoKey> {
  const db = await openDb();
  try {
    const existing = await reqToPromise(
      db.transaction(STORE_KEYS, "readonly").objectStore(STORE_KEYS).get(LOCAL_AES_KEY_ID),
    );
    if (existing instanceof ArrayBuffer || ArrayBuffer.isView(existing)) {
      const bytes =
        existing instanceof ArrayBuffer
          ? new Uint8Array(existing)
          : new Uint8Array(
              existing.buffer.slice(
                existing.byteOffset,
                existing.byteOffset + existing.byteLength,
              ) as ArrayBuffer,
            );
      return await crypto.subtle.importKey("raw", bytes, { name: "AES-GCM" }, false, [
        "encrypt",
        "decrypt",
      ]);
    }
  } finally {
    db.close();
  }

  // First run: mint a fresh 256-bit key.
  const keyBytes = crypto.getRandomValues(allocBytes(32));
  const db2 = await openDb();
  try {
    const tx = db2.transaction(STORE_KEYS, "readwrite");
    tx.objectStore(STORE_KEYS).put(keyBytes.buffer as ArrayBuffer, LOCAL_AES_KEY_ID);
    await txDone(tx);
  } finally {
    db2.close();
  }
  return await crypto.subtle.importKey("raw", keyBytes, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function bytesToBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

/** Allocate a Uint8Array backed by a plain ArrayBuffer (not ArrayBufferLike),
 *  which satisfies the BufferSource type required by Web Crypto. */
function allocBytes(len: number): Uint8Array<ArrayBuffer> {
  return new Uint8Array(new ArrayBuffer(len));
}

function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = allocBytes(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Encrypt a pickle string into a sealed envelope. */
export async function seal(plaintext: string): Promise<SealedEnvelope> {
  const key = await getOrCreateAesKey();
  const iv = crypto.getRandomValues(allocBytes(12));
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    ),
  );
  return { v: 1, iv: bytesToBase64(iv), ct: bytesToBase64(sealed) };
}

/** Decrypt a sealed envelope back into the pickle string. */
export async function unseal(envelope: SealedEnvelope): Promise<string> {
  if (envelope.v !== 1) throw new Error(`unsupported envelope version ${envelope.v}`);
  const key = await getOrCreateAesKey();
  const pt = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBytes(envelope.iv) },
    key,
    base64ToBytes(envelope.ct),
  );
  return new TextDecoder().decode(pt);
}

/** Write a sealed record. Plaintext pickles must never be passed here. */
export async function putSealed(key: string, envelope: SealedEnvelope): Promise<void> {
  const db = await openDb();
  try {
    const tx = db.transaction(STORE_STATE, "readwrite");
    tx.objectStore(STORE_STATE).put(envelope, key);
    await txDone(tx);
  } finally {
    db.close();
  }
}

/** Read a sealed record; returns null when absent. */
export async function getSealed(key: string): Promise<SealedEnvelope | null> {
  const db = await openDb();
  try {
    const result = await reqToPromise(
      db.transaction(STORE_STATE, "readonly").objectStore(STORE_STATE).get(key),
    );
    return (result as SealedEnvelope | undefined) ?? null;
  } finally {
    db.close();
  }
}

/** Remove all spike state (both stores). Used by the "reset" button. */
export async function clearAll(): Promise<void> {
  aesKeyPromise = null; // drop the memoized key so a fresh one is minted next time
  const db = await openDb();
  try {
    const tx = db.transaction([STORE_STATE, STORE_KEYS], "readwrite");
    tx.objectStore(STORE_STATE).clear();
    tx.objectStore(STORE_KEYS).clear();
    await txDone(tx);
  } finally {
    db.close();
  }
}

/**
 * Read every sealed record and confirm no stored value contains plaintext
 * key markers. Returns the offending keys, if any. Used by the tamper-
 * detection style test: sealed envelopes must be {v,iv,ct} only.
 */
export async function auditNoPlaintextKeys(): Promise<string[]> {
  const db = await openDb();
  try {
    const all = await reqToPromise(
      db.transaction(STORE_STATE, "readonly").objectStore(STORE_STATE).getAll(),
    );
    const offending: string[] = [];
    for (const value of all as SealedEnvelope[]) {
      const serialized = JSON.stringify(value);
      if (
        serialized.includes("signing_key") ||
        serialized.includes("diffie_hellman") ||
        serialized.includes("private")
      ) {
        offending.push("plaintext key marker found in a sealed record");
        break;
      }
      if (!value || value.v !== 1 || typeof value.iv !== "string" || typeof value.ct !== "string") {
        offending.push("record is not a well-formed sealed envelope");
        break;
      }
    }
    return offending;
  } finally {
    db.close();
  }
}
