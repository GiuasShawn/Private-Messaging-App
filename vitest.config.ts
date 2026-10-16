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
    include: ["tests/**/*.test.ts"],
    // The WASM module is global process state; isolate per file so each
    // test file gets a clean module registry where needed.
    pool: "forks",
    testTimeout: 20000,
  },
});
