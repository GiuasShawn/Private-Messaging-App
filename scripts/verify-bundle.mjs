#!/usr/bin/env node
// Verifies that the generated client assets contain no Supabase secret
// material. Run after `next build`; CI runs build → test → this check.
//
// Usage: node scripts/verify-bundle.mjs   (or: npm run verify:bundle)
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";

import { scanClientBundle } from "./lib/scan-client-bundle.mjs";

const root = process.cwd();
const staticDir = path.join(root, ".next", "static");

if (!existsSync(staticDir)) {
  console.error(
    "verify-bundle: .next/static not found. Run `npm run build` first — " +
      "this check must examine real generated client assets, not sources."
  );
  process.exit(2);
}

const { files, bytes, findings } = scanClientBundle(staticDir, [
  process.env.SUPABASE_SECRET_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
]);

console.log(
  `verify-bundle: scanned ${files.length} client asset(s), ` +
    `${(bytes / 1024).toFixed(1)} KiB, under ${path.relative(root, staticDir)}`
);

if (findings.length > 0) {
  console.error("verify-bundle: FORBIDDEN secret material found in client assets:");
  for (const finding of findings) {
    console.error(`  - ${finding.pattern} in ${finding.file}`);
  }
  process.exit(1);
}

console.log("verify-bundle: no secret material in client assets. OK");
