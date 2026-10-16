// Browser Supabase client, for Client Components only.
//
// Uses only public values: the project URL and the publishable key, both of
// which are safe to ship in the client bundle. This module must never read
// SUPABASE_SECRET_KEY (enforced by ESLint and the client-bundle leak test).
//
// createBrowserClient keeps a singleton per browser context, so calling this
// from multiple components is cheap and safe (Supabase SSR docs).
import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export function createClient() {
  return createBrowserClient(getSupabaseUrl(), getSupabasePublishableKey());
}
