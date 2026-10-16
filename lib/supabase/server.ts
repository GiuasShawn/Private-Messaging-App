// Server Supabase client, for Server Components, Server Actions and Route
// Handlers. Never import this from a Client Component: the "server-only"
// import makes `next build` fail if a browser bundle reaches this module.
//
// Authorization note (Supabase SSR docs): when protecting pages or data,
// call `supabase.auth.getClaims()` — it verifies the JWT signature on every
// call. Never authorize with `supabase.auth.getSession()`, which trusts the
// cookie contents without revalidating them.
import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export async function createClient() {
  // Next.js 15+ returns a promise from cookies(); one client per request.
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabasePublishableKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot write cookies; the thrown error is
          // expected there and intentionally ignored. The Proxy (proxy.ts)
          // writes refreshed cookies and the accompanying cache protections
          // on every request (Supabase SSR docs).
        }
        // The cache headers (Cache-Control / Expires / Pragma) are HTTP
        // response headers and cannot be set from a Server Component render.
        // proxy.ts applies them to the response it returns.
        void cacheHeaders;
      },
    },
  });
}
