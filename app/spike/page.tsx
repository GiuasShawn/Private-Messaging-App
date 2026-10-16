"use client";

/**
 * Phase 0.5 cryptographic feasibility spike.
 *
 * Runs the full experiment in the browser:
 *   A. WASM initialization
 *   B. Olm session establishment
 *   C. Tamper rejection
 *   E. Megolm round trip
 *   D. Persist (sealed) -> reload -> restore -> continue
 * plus a live fetch monitor proving no plaintext/keys leave the page.
 *
 * Test identities and test plaintext only. This page is not part of the
 * production messenger and can be deleted after Phase 0.5.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import type { StepResult } from "@/lib/spike/run";

type Phase = "idle" | "phase1" | "saved" | "restoring" | "done";

export default function SpikePage() {
  const [steps, setSteps] = useState<StepResult[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [networkLog, setNetworkLog] = useState<string[]>([]);
  // Canaries are generated in handlers/effects, never during render, so the
  // route can be statically prerendered (Next 16 blocks Math.random() in a
  // client component's render path). They are test plaintext, not secrets.
  const [canary, setCanary] = useState<string | null>(null);
  const [continuationCanary, setContinuationCanary] = useState<string | null>(null);
  const monitorRef = useRef<boolean>(false);

  const newCanary = (label: string) =>
    `${label}-${Math.random().toString(36).slice(2, 10)}-END`;

  // Fetch monitor: record every outbound request during the run. We never
  // call fetch ourselves, so anything here is third-party or a leak.
  useEffect(() => {
    if (monitorRef.current || typeof window === "undefined") return;
    monitorRef.current = true;
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const req = args[0];
      const url =
        typeof req === "string"
          ? req
          : req instanceof URL
            ? req.toString()
            : (req as Request).url;
      const body = args[1]?.body;
      let bodyStr = "";
      if (typeof body === "string") bodyStr = body;
      else if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) {
        bodyStr = `[binary ${body.byteLength}B]`;
      }
      setNetworkLog((log) => [...log, `${args[1]?.method ?? "GET"} ${url}${bodyStr ? ` body=${bodyStr.slice(0, 80)}` : ""}`]);
      return originalFetch(...args);
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, []);

  const runPhase1 = useCallback(async () => {
    setPhase("phase1");
    setSteps([]);
    setError(null);
    const runCanary = newCanary("SPIKE-CANARY");
    setCanary(runCanary); // display-only; test plaintext, not a secret
    try {
      const { runPhase1 } = await import("@/lib/spike/run");
      const { steps: results, ctx } = await runPhase1(runCanary);
      setSteps(results);
      if (!ctx) {
        setPhase("idle");
        return;
      }
      // Pass ctx straight to saveState; it is never placed into React state,
      // the URL, or sessionStorage.
      const { saveState } = await import("@/lib/spike/run");
      const saveResult = await saveState(ctx);
      setSteps((s) => [...s, saveResult]);
      if (saveResult.status === "pass") {
        setPhase("saved");
      } else {
        setPhase("idle");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }, []);

  const reloadAndRestore = useCallback(async () => {
    setPhase("restoring");
    // Real page reload: sessionStorage flags that we should auto-restore.
    try {
      sessionStorage.setItem("spike:autoRestore", "1");
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("idle");
    }
  }, []);

  // On mount: if flagged, run the restore half after a real reload.
  // The continuation canary is generated here (not during render) so the
  // route stays statically prerenderable.
  const restoreRanRef = useRef(false);
  useEffect(() => {
    if (restoreRanRef.current || typeof window === "undefined") return;
    let flag: string | null = null;
    try {
      flag = sessionStorage.getItem("spike:autoRestore");
      if (flag === "1") sessionStorage.removeItem("spike:autoRestore");
    } catch {
      /* ignore */
    }
    if (flag !== "1") return;
    restoreRanRef.current = true;

    const restoreCanary = newCanary("SPIKE-POSTRELOAD");
    setContinuationCanary(restoreCanary); // display-only

    (async () => {
      try {
        setPhase("restoring");
        const { stepA_wasmInit, loadAndContinue } = await import("@/lib/spike/run");
        const { result: aResult, v } = await stepA_wasmInit();
        setSteps([aResult]);
        if (aResult.status !== "pass") {
          setPhase("idle");
          return;
        }
        const { steps: restoreSteps } = await loadAndContinue(v, restoreCanary);
        setSteps((s) => [...s, ...restoreSteps]);
        setPhase("done");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setPhase("idle");
      }
    })();
  }, []);

  const resetAll = useCallback(async () => {
    try {
      const { clearAll } = await import("@/lib/spike/store");
      await clearAll();
      setSteps([]);
      setPhase("idle");
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem", maxWidth: "52rem" }}>
      <h1 style={{ fontSize: "1.4rem" }}>Phase 0.5 — Crypto Feasibility Spike</h1>
      <p style={{ color: "#666" }}>
        Synthetic identities and hard-coded test plaintext only. No accounts, no
        server, no real conversations.
      </p>

      <section style={{ marginTop: "1.5rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>Steps</h2>
        <ol style={{ listStyle: "none", padding: 0 }}>
          {steps.map((s) => (
            <li
              key={s.id}
              style={{
                margin: "0.4rem 0",
                padding: "0.5rem 0.7rem",
                borderLeft: `4px solid ${s.status === "pass" ? "#2e7d32" : s.status === "fail" ? "#c62828" : "#9e9e9e"}`,
                background: "#f7f7f7",
              }}
            >
              <strong>
                [{s.id}] {s.label}
              </strong>{" "}
              <em>({s.status})</em>
              <div style={{ fontSize: "0.85rem", color: "#444" }}>{s.detail}</div>
            </li>
          ))}
        </ol>
      </section>

      <section style={{ marginTop: "1.5rem", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={runPhase1}
          disabled={phase === "phase1" || phase === "restoring"}
          style={{ padding: "0.5rem 1rem" }}
        >
          1. Run handshake + tamper + Megolm, seal &amp; save
        </button>
        <button
          onClick={reloadAndRestore}
          disabled={phase !== "saved"}
          style={{ padding: "0.5rem 1rem" }}
        >
          2. Reload page &amp; restore session
        </button>
        <button onClick={resetAll} style={{ padding: "0.5rem 1rem" }}>
          Reset local state
        </button>
      </section>

      {error && (
        <p style={{ marginTop: "1rem", color: "#c62828" }}>Error: {error}</p>
      )}

      {phase === "saved" && (
        <p style={{ marginTop: "1rem", color: "#2e7d32" }}>
          State sealed and saved. Click step 2 to reload and restore.
        </p>
      )}

      <section style={{ marginTop: "2rem" }}>
        <h2 style={{ fontSize: "1.1rem" }}>
          Outbound network requests during run ({networkLog.length})
        </h2>
        {networkLog.length === 0 ? (
          <p style={{ color: "#666" }}>No fetch() calls observed.</p>
        ) : (
          <ul style={{ fontSize: "0.8rem", color: "#444" }}>
            {networkLog.map((entry, i) => (
              <li key={i}>
                <code>{entry}</code>
              </li>
            ))}
          </ul>
        )}
        <p style={{ fontSize: "0.8rem", color: "#666" }}>
          This monitor only covers <code>window.fetch</code>. It is evidence,
          not proof — verify in DevTools → Network as well. No plaintext or key
          material should appear in any request body.
        </p>
      </section>

      <p style={{ marginTop: "2rem", fontSize: "0.8rem", color: "#999" }}>
        Canary in use: <code>{canary ?? "(generated on run)"}</code> · post-reload
        canary: <code>{continuationCanary ?? "(generated on restore)"}</code>
      </p>
    </main>
  );
}
