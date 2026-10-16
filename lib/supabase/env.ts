// Public (browser-safe) Supabase environment accessors.
//
// Only NEXT_PUBLIC_* values are read here. Next.js inlines these into both
// server and browser bundles, so nothing in this module may ever reference a
// server-only secret. lib/supabase/admin.ts is the single application module
// allowed to read SUPABASE_SECRET_KEY; that boundary is enforced by the
// ESLint secret guard, the "server-only" import in admin.ts, and the
// client-bundle leak test (tests/bundle/client-bundle-secrets.test.ts).

/** Project URL. Safe to expose: it identifies the Supabase project only. */
export function getSupabaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL. Copy .env.example to .env.local and fill in the Supabase project values."
    );
  }
  return url;
}

/**
 * Publishable API key. Safe to expose by design: it can only be used where
 * Row Level Security permits (Supabase API-keys docs). The secret key must
 * never be passed to browser code.
 */
export function getSupabasePublishableKey(): string {
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Copy .env.example to .env.local and fill in the Supabase project values."
    );
  }
  return key;
}
