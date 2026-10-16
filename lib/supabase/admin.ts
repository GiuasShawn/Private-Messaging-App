// Admin Supabase client — the ONLY application module allowed to read the
// Supabase secret key. Its credentials bypass Row Level Security, so use it
// exclusively for narrowly scoped, trusted server operations (device status
// transitions, account provisioning). Never import this from a Client
// Component or from proxy.ts: the "server-only" import makes `next build`
// fail if a browser bundle reaches this module, and the ESLint secret guard
// plus tests/bundle/client-bundle-secrets.test.ts verify the key never ships
// to the browser.
//
// For plain-Node operator scripts (e.g. scripts/provision-user.mts in a later
// step), run node with `--conditions=react-server` so "server-only" resolves
// to its inert entry, or construct an equivalent client inline in the script.
import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createAdminClient() {
  // SUPABASE_URL (non-prefixed) is accepted as a convenience for operator
  // scripts that load server-side environment without Next.js inlining.
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;

  if (!url || !secretKey) {
    throw new Error(
      "Missing Supabase server configuration. createAdminClient requires " +
        "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY " +
        "in the server environment. The secret key must never be exposed to " +
        "the browser."
    );
  }

  return createSupabaseClient(url, secretKey, {
    auth: {
      // Admin clients are constructed per operation on the server; session
      // persistence and token auto-refresh would only add background work.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
