import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

// ---------------------------------------------------------------------------
// Supabase secret guard.
//
// Server-only secrets must never be read from code that can be bundled for
// the browser, and no Supabase secret may ever be given a NEXT_PUBLIC_*
// name (Next.js inlines those into the browser bundle at build time).
//
// Allow-listed exceptions:
//   - lib/supabase/admin.ts: the single application module permitted to read
//     SUPABASE_SECRET_KEY (server-only import + bundle leak test on top).
//   - scripts/**, tests/**: plain Node, never bundled; they may reference
//     server env names (including canary values) for provisioning and tests.
// ---------------------------------------------------------------------------

const SERVER_SECRET_NAMES =
  "SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_JWT_SECRET";

const SERVER_SECRET_MESSAGE =
  "Supabase secret keys are server-only. Reading them outside " +
  "lib/supabase/admin.ts risks shipping one to the browser; the " +
  "secret-key access point is guarded there and verified by " +
  "tests/bundle/client-bundle-secrets.test.ts.";

const NEXT_PUBLIC_SECRET_MESSAGE =
  "NEXT_PUBLIC_* variables are inlined into the browser bundle at build " +
  "time. Never expose a Supabase secret through a NEXT_PUBLIC_* name.";

// Selector design note: esquery combinators (`>` / descendant) follow
// traversal ancestry, where `process.env` is a *descendant* of the full
// `process.env.SUPABASE_SECRET_KEY` expression. Single-node selectors are
// used instead — they are direction-agnostic, also catch bracket access
// (`process.env["SUPABASE_SECRET_KEY"]`) and destructuring
// (`const { SUPABASE_SECRET_KEY } = process.env`), and were verified to
// fire under real ESLint traversal (see commit message for the probe).
const secretKeySelector = {
  selector: `Identifier[name=/^(${SERVER_SECRET_NAMES})$/]`,
  message: SERVER_SECRET_MESSAGE,
};

const secretKeyComputedSelector = {
  selector: `MemberExpression[computed=true][property.value=/^(${SERVER_SECRET_NAMES})$/]`,
  message: SERVER_SECRET_MESSAGE,
};

const nextPublicSecretSelector = {
  selector: "Identifier[name=/^NEXT_PUBLIC_SUPABASE_(SECRET|SERVICE_ROLE)/]",
  message: NEXT_PUBLIC_SECRET_MESSAGE,
};

const nextPublicSecretComputedSelector = {
  selector:
    "MemberExpression[computed=true][property.value=/^NEXT_PUBLIC_SUPABASE_(SECRET|SERVICE_ROLE)/]",
  message: NEXT_PUBLIC_SECRET_MESSAGE,
};

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Default: no file may read a Supabase server secret, and nothing may
  // wrap one in NEXT_PUBLIC_*.
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs,mts}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        nextPublicSecretSelector,
        nextPublicSecretComputedSelector,
        secretKeySelector,
        secretKeyComputedSelector,
      ],
    },
  },
  // Allow-listed files: only the NEXT_PUBLIC_* restriction applies. This
  // config object replaces the rule above for exactly these files (flat
  // config semantics), so scripts/tests/admin may read server env names.
  {
    files: [
      "lib/supabase/admin.ts",
      "scripts/**/*.{ts,tsx,js,mjs,mts}",
      "tests/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        nextPublicSecretSelector,
        nextPublicSecretComputedSelector,
      ],
    },
  },
  // Tests declare typed mock factories whose parameters exist only to shape
  // the call tuple (e.g. vi.fn((_url: string) => ...)); underscore prefix
  // marks them as intentionally unused.
  {
    files: ["tests/**/*.{ts,tsx}"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
