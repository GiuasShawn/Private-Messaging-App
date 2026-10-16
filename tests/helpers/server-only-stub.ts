// Inert stand-in for the "server-only" package under Vitest.
//
// The real package throws outside a React Server Components context, which
// is exactly how `next build` enforces the server/browser boundary: a Client
// Component that imports lib/supabase/server.ts or lib/supabase/admin.ts
// fails the build. That enforcement is a bundler behavior and cannot run
// inside unit tests; the shipped result is verified separately against the
// real build output by tests/bundle/client-bundle-secrets.test.ts.
export {};
