// Haven database verification runner (Phase 2, Step 2).
//
// Applies nothing and mutates nothing permanently: the schema must already be
// migrated (CI runs `npx supabase db reset` first). The runner connects to a
// local Supabase Postgres, verifies the profiles schema/RLS configuration,
// exercises allowed and denied access paths under real PostgREST role/claims
// conditions, and removes its test identities afterwards.
//
// Exit codes:
//   0 - every check passed
//   1 - one or more checks failed
//   2 - prerequisites missing (database unreachable, migrations not applied)
//
// Target selection: SUPABASE_DB_URL, defaulting to the `supabase start`
// local database. See scripts/lib/db-verify-core.mjs for the test strategy
// and its documented limitations.

import process from "node:process";
import { Client } from "pg";

import { PrereqError, runVerification } from "./lib/db-verify-core.mjs";

const DEFAULT_LOCAL_DB_URL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const connectionString = process.env.SUPABASE_DB_URL || DEFAULT_LOCAL_DB_URL;

function redactUrl(url) {
  return url.replace(/:\/\/[^@/]*@/, "://***@");
}

console.log(`verify-db: targeting ${redactUrl(connectionString)}`);

try {
  const results = await runVerification({
    createClient: async () => {
      const client = new Client({
        connectionString,
        connectionTimeoutMillis: 5000,
      });
      await client.connect();
      return client;
    },
  });

  const failed = results.filter((result) => !result.ok);
  console.log("");
  if (failed.length > 0) {
    console.error(`verify-db: ${failed.length} of ${results.length} checks FAILED:`);
    for (const result of failed) {
      console.error(`  - ${result.name}: ${result.error}`);
    }
    process.exit(1);
  }
  console.log(`verify-db: all ${results.length} checks passed`);
} catch (error) {
  if (error instanceof PrereqError) {
    console.error(`verify-db: prerequisites not met: ${error.message}`);
    process.exit(2);
  }
  console.error(`verify-db: unexpected error: ${error.stack ?? error.message}`);
  process.exit(1);
}
