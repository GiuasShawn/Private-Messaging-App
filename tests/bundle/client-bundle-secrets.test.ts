// Verifies that the REAL generated client assets contain no Supabase
// secret material.
//
// This reads the files under .next/static — exactly the JavaScript shipped
// to browsers — so a secret reaching the browser through any import path is
// caught. A source-code grep alone is not sufficient and is not used here.
// If no build exists, this test builds the app first; it never skips.
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  scanClientBundle,
} from "../../scripts/lib/scan-client-bundle.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const staticDir = path.join(root, ".next", "static");

// Building the app can take well over the default 20s test timeout.
const BUILD_TIMEOUT_MS = 300_000;

describe("client bundle secret scan (real build output)", () => {
  it("scanner flags planted secrets (non-vacuity check)", () => {
    const fixtureDir = mkdtempSync(path.join(tmpdir(), "haven-bundle-scan-"));
    try {
      // A clean client chunk plus one that smuggles in a secret-shaped
      // string; the scanner must flag the directory.
      writeFileSync(path.join(fixtureDir, "clean.js"), "export const a = 1;");
      writeFileSync(
        path.join(fixtureDir, "smuggled.js"),
        'const key = "sb_secret_planted_for_test";'
      );
      const result = scanClientBundle(fixtureDir);
      expect(result.files.length).toBe(2);
      expect(result.findings.length).toBeGreaterThan(0);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });

  it(
    "contains no Supabase secret material in assets served to browsers",
    { timeout: BUILD_TIMEOUT_MS },
    () => {
      if (!existsSync(staticDir)) {
        // Build once so this test always examines real assets; it must
        // never silently pass on an empty scan.
        execFileSync(
          process.execPath,
          [path.join(root, "node_modules", "next", "dist", "bin", "next"), "build"],
          { cwd: root, stdio: "pipe", timeout: BUILD_TIMEOUT_MS }
        );
      }

      const { files, findings } = scanClientBundle(staticDir, [
        process.env.SUPABASE_SECRET_KEY,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
      ].filter((value): value is string => Boolean(value)));

      // Sanity: we actually scanned the generated client assets.
      expect(files.length).toBeGreaterThan(0);
      expect(findings).toEqual([]);
    }
  );
});
