// Next.js 16 Proxy (the file convention formerly known as middleware.ts).
// Session-refresh plumbing only — Phase 2, Step 1.
//
// Responsibilities here (Supabase SSR docs):
//   1. Refresh the Auth token with `supabase.auth.getClaims()`, which
//      verifies the JWT signature; the claims are not consumed in this step.
//   2. Hand refreshed cookies back to the request (request.cookies.set) so
//      Server Components do not refresh the same token again, and to the
//      browser (response.cookies.set) so the new token replaces the old one.
//   3. Propagate the Cache-Control / Expires / Pragma headers that accompany
//      the cookie write, so no CDN can cache a response that carries a
//      session token and serve it to a different user.
//
// Deliberately NOT done here: authorization redirects. Per the Next.js and
// Supabase docs the Proxy is an optimistic check, never the security
// boundary. Protected routes will verify claims in server code in a later
// step; Row Level Security re-enforces authorization in the database.
//
// Transitional behavior: while Supabase is not yet configured (this step
// commits no environment values), the Proxy is a pure pass-through so the
// Phase 1 UI and its verification harnesses behave exactly as before.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !publishableKey) {
    // No Supabase configured yet: building a client here would throw on the
    // invalid configuration. Forward the request untouched.
    return NextResponse.next({ request });
  }

  // Create a fresh client per request (the @supabase/ssr cache headers are
  // delivered with the first cookie write of each client instance; reusing
  // one across requests would leave later responses unprotected).
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, cacheHeaders) {
        // 1. Feed refreshed cookies back into the incoming request so Server
        //    Components read the new session without refreshing it again.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        // 2. Rebuild the response so it carries the refreshed cookies.
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options);
        });
        // 3. Cache protections: a response that sets auth cookies must never
        //    be cached, or one user's session could be served to another.
        Object.entries(cacheHeaders).forEach(([header, value]) => {
          supabaseResponse.headers.set(header, value);
        });
      },
    },
  });

  // Refresh the session when the token is close to expiry. getClaims()
  // verifies the JWT signature on every call; the result is intentionally
  // unused — this step only keeps sessions alive.
  await supabase.auth.getClaims();

  // IMPORTANT: return the response built by the *last* setAll call; an
  // earlier one would not carry the refreshed cookies (Supabase SSR docs).
  return supabaseResponse;
}

export const config = {
  // Run on application routes; skip Next.js internals, static assets, and
  // the Phase 0.5 spike page, which must stay behaviorally untouched for
  // its browser verification harness.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|spike|.*\\.(?:svg|png|jpe?g|gif|webp|ico|woff2?|wasm)$).*)",
  ],
};
