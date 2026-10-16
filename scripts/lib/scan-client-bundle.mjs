// Scans generated Next.js client assets for Supabase secret material.
//
// This examines the REAL build output — .next/static is exactly the
// JavaScript shipped to browsers — so a secret reaching the browser through
// any import path, transitive dependency, or build-plugin side effect is
// caught. A source-code grep alone cannot provide that guarantee.
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/** Patterns that must never appear in browser-served assets. */
export const FORBIDDEN_PATTERNS = [
  { name: "Supabase secret key prefix (sb_secret_)", pattern: /sb_secret_/ },
  { name: "Supabase secret env var name", pattern: /SUPABASE_SECRET_KEY/ },
  { name: "Legacy service_role JWT role", pattern: /service_role/ },
  { name: "Legacy service-role env var name", pattern: /SUPABASE_SERVICE_ROLE/ },
];

const ASSET_EXTENSIONS = new Set([".js", ".mjs", ".css"]);

function listAssetFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listAssetFiles(full));
    } else if (ASSET_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Scan a Next.js static-asset directory for forbidden patterns.
 *
 * @param {string} staticDir Path to .next/static (or a fixture directory).
 * @param {string[]} [extraSecrets] Literal secret values (e.g. from the
 *   environment) to also flag — catches an actual key leaking even if its
 *   shape is unknown to FORBIDDEN_PATTERNS.
 * @returns {{ files: string[], bytes: number, findings: { file: string, pattern: string }[] }}
 */
export function scanClientBundle(staticDir, extraSecrets = []) {
  const files = listAssetFiles(staticDir);
  const findings = [];
  let bytes = 0;

  const patterns = [...FORBIDDEN_PATTERNS];
  for (const secret of extraSecrets) {
    if (secret && secret.length >= 8) {
      patterns.push({ name: "literal secret value from environment", pattern: new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")) });
    }
  }

  for (const file of files) {
    const content = readFileSync(file, "utf8");
    bytes += content.length;
    for (const { name, pattern } of patterns) {
      if (pattern.test(content)) {
        findings.push({ file: path.relative(process.cwd(), file), pattern: name });
      }
    }
  }

  return { files, bytes, findings };
}
