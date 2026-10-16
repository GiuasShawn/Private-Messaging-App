import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      // The real "server-only" package throws outside a React Server
      // Components context; that browser-boundary enforcement belongs to
      // `next build` (a Client Component importing lib/supabase/server.ts
      // or admin.ts fails the build). Unit tests run in plain Node, where
      // the package's default entry would throw as well, so resolve it to
      // an inert stub that mirrors its "react-server" entry.
      "server-only": path.resolve(
        __dirname,
        "tests/helpers/server-only-stub.ts"
      ),
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
