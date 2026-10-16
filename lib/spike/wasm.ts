/**
 * Isolated WASM bootstrap for the Phase 0.5 spike.
 *
 * Two load paths, selected by runtime:
 *  - Browser (pkg-web): the wasm-bindgen "web" target requires an explicit
 *    async `init()` before any class can be constructed. We pass the URL of
 *    the `.wasm` asset served from /public explicitly instead of relying on
 *    the glue's `new URL(..., import.meta.url)` default, because the default
 *    interacts differently with webpack vs Turbopack asset pipelines. An
 *    explicit same-origin URL behaves identically under both and in `next
 *    start` production builds.
 *  - Node (pkg-node): the wasm-bindgen "nodejs" target initializes the
 *    module synchronously at import time (fs.readFileSync + compile). No
 *    init call exists; importing is sufficient.
 *
 * The module is imported via dynamic import() so it is never evaluated in a
 * Server Component / RSC context; only client code calls loadCrypto().
 * This is a spike-only loader — production key/loading policy is out of scope.
 */

export const WASM_ASSET_URL = "/wasm/kinsh_vodozemac_wasm_bg.wasm";

export type Vodozemac = typeof import("@kinsh/vodozemac-wasm");

let loadPromise: Promise<Vodozemac> | null = null;

/**
 * Load and initialize the vodozemac WASM module exactly once.
 * Throws on failure with a sanitized message (never includes key material).
 */
export function loadCrypto(): Promise<Vodozemac> {
  if (!loadPromise) {
    loadPromise = doLoad().catch((err: unknown) => {
      // Allow a retry after a failed initialization.
      loadPromise = null;
      throw sanitizeError(err);
    });
  }
  return loadPromise;
}

async function doLoad(): Promise<Vodozemac> {
  if (typeof window === "undefined") {
    // Node/Vitest path: pkg-node self-initializes on import.
    const mod = await import("@kinsh/vodozemac-wasm");
    return mod;
  }
  const mod = (await import("@kinsh/vodozemac-wasm")) as {
    default: (input?: unknown) => Promise<unknown>;
  } & Vodozemac;
  await mod.default({ module_or_path: WASM_ASSET_URL });
  return mod;
}

/** Strip anything that could leak secrets from an init failure message. */
export function sanitizeError(err: unknown): Error {
  const raw = err instanceof Error ? err.message : String(err);
  // WASM init errors are environmental (network, MIME, unsupported) — keep
  // the message but drop any base64-looking blobs just in case.
  const safe = raw.replace(/[A-Za-z0-9+/_-]{40,}={0,2}/g, "[redacted-long-token]");
  return new Error(`vodozemac WASM init failed: ${safe}`);
}
