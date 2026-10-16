// Copies the pkg-web .wasm asset into public/wasm/ so the client can fetch
// it from an explicit same-origin URL (bundler-agnostic; avoids relying on
// `new URL(..., import.meta.url)` asset handling under Turbopack vs webpack).
// Run automatically via the npm "postinstall" hook.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(root, "node_modules", "@kinsh", "vodozemac-wasm", "pkg-web", "kinsh_vodozemac_wasm_bg.wasm");
const destDir = join(root, "public", "wasm");
const dest = join(destDir, "kinsh_vodozemac_wasm_bg.wasm");

if (!existsSync(src)) {
  console.warn(`[copy-wasm] source not found, skipping: ${src}`);
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log(`copied WASM asset -> ${dest}`);
