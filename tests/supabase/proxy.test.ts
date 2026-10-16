// Unit tests for the root Next.js 16 Proxy (session-refresh plumbing).
//
// Verifies the documented behaviors that matter for session correctness and
// CDN safety: the Proxy refreshes via getClaims(), feeds refreshed cookies
// back into the request and onto the response, propagates the cache
// protections that come with the cookie write, and — until Supabase env
// vars exist — is a pure pass-through so Phase 1 behavior is unchanged.
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getClaimsMock, createServerClientMock } = vi.hoisted(() => ({
  getClaimsMock: vi.fn(async (): Promise<null> => null),
  createServerClientMock: vi.fn(
    (_url: string, _publishableKey: string, _options: unknown) => ({
      auth: { getClaims: getClaimsMock },
    })
  ),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

import { config, proxy } from "@/proxy";

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options: Record<string, unknown> }[],
    cacheHeaders: Record<string, string>
  ) => void;
};

function getAdapter(): CookieAdapter {
  const options = createServerClientMock.mock.calls[0][2] as unknown as {
    cookies: CookieAdapter;
  };
  return options.cookies;
}

describe("proxy (session-refresh plumbing)", () => {
  beforeEach(() => {
    createServerClientMock.mockClear();
    getClaimsMock.mockClear();
    getClaimsMock.mockResolvedValue(null);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_canary_value_xyz");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("passes the request through untouched when Supabase is not configured", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", undefined);

    const response = await proxy(new NextRequest("http://haven.local/chat"));

    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(getClaimsMock).not.toHaveBeenCalled();
    expect(response.status).toBe(200);
  });

  it("refreshes the session once per request via verified claims", async () => {
    const response = await proxy(new NextRequest("http://haven.local/chat"));

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    expect(getClaimsMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it("never passes the secret key to the client factory", async () => {
    await proxy(new NextRequest("http://haven.local/chat"));

    expect(JSON.stringify(createServerClientMock.mock.calls)).not.toContain(
      "sb_secret"
    );
  });

  it("wires the cookie adapter to the incoming request's cookies", async () => {
    const request = new NextRequest("http://haven.local/chat", {
      headers: { cookie: "existing-cookie=1" },
    });

    await proxy(request);

    const adapter = getAdapter();
    expect(adapter.getAll()).toEqual([
      { name: "existing-cookie", value: "1" },
    ]);
  });

  it("propagates refreshed cookies and cache protections onto the response", async () => {
    // Simulate a token refresh: the library writes cookies mid-request.
    getClaimsMock.mockImplementationOnce(async () => {
      getAdapter().setAll(
        [
          {
            name: "sb-example-auth-token",
            value: "refreshed-session",
            options: { path: "/", httpOnly: true },
          },
        ],
        {
          "Cache-Control":
            "private, no-cache, no-store, must-revalidate, max-age=0",
          Expires: "0",
          Pragma: "no-cache",
        }
      );
      return null;
    });

    const request = new NextRequest("http://haven.local/chat");
    const response = await proxy(request);

    // The browser receives the refreshed cookie...
    expect(response.cookies.get("sb-example-auth-token")?.value).toBe(
      "refreshed-session"
    );
    // ...and the cache protections that keep CDNs from serving this
    // response (and its Set-Cookie) to another user.
    expect(response.headers.get("cache-control")).toBe(
      "private, no-cache, no-store, must-revalidate, max-age=0"
    );
    expect(response.headers.get("expires")).toBe("0");
    expect(response.headers.get("pragma")).toBe("no-cache");
    // Server Components read the refreshed session from the request itself.
    expect(request.cookies.get("sb-example-auth-token")?.value).toBe(
      "refreshed-session"
    );
  });

  it("does not authorize or redirect — that boundary lives in server code", async () => {
    // Even with no session at all, the Proxy forwards the request.
    getClaimsMock.mockResolvedValueOnce(null);

    const response = await proxy(new NextRequest("http://haven.local/chat"));

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("matcher covers app routes and excludes the spike and static assets", () => {
    // Next.js matches the pattern against the full request path; anchor it
    // the same way when testing.
    const matcher = new RegExp(`^${config.matcher[0]}$`);

    expect(matcher.test("/chat")).toBe(true);
    expect(matcher.test("/login")).toBe(true);
    expect(matcher.test("/devices")).toBe(true);
    expect(matcher.test("/spike")).toBe(false);
    expect(matcher.test("/_next/static/chunks/main.js")).toBe(false);
    expect(matcher.test("/favicon.ico")).toBe(false);
  });
});
