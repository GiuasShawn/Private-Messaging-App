import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    // Spike tests (tests/*.test.ts) run in the default node environment.
    // UI tests (tests/ui/*.test.tsx) opt into jsdom via the
    // "@vitest-environment jsdom" docblock at the top of each file.
    include: ["tests/**/*.test.{ts,tsx}"],
    setupFiles: ["tests/setup.ts"],
    // The WASM module is global process state; isolate per file so each
    // test file gets a clean module registry where needed.
    pool: "forks",
    testTimeout: 20000,
  },
});
