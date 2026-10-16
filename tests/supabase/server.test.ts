// Unit tests for the server Supabase client factory.
//
// Verifies the cookie adapter wiring: reads delegate to the request cookie
// store, writes go through the store with their options, and write failures
// (expected when rendered from a Server Component, which cannot set cookies)
// are swallowed as documented by the Supabase SSR guide.
import { beforeEach, describe, expect, it, vi } from "vitest";

const { cookieStore, createServerClientMock } = vi.hoisted(() => ({
  cookieStore: {
    getAll: vi.fn(() => [{ name: "existing", value: "1" }]),
    set: vi.fn(),
  },
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => cookieStore),
}));

import { createClient } from "@/lib/supabase/server";

type CookieAdapter = {
  getAll: () => { name: string; value: string }[];
  setAll: (
    cookies: { name: string; value: string; options: Record<string, unknown> }[],
    cacheHeaders: Record<string, string>
  ) => void;
};

function getAdapter(): CookieAdapter {
  const options = createServerClientMock.mock.calls[0][2] as {
    cookies: CookieAdapter;
  };
  return options.cookies;
}

describe("lib/supabase/server (server client)", () => {
  beforeEach(() => {
    createServerClientMock.mockReset().mockReturnValue({ __kind: "server-client" });
    cookieStore.getAll.mockClear();
    cookieStore.set.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_canary_value_xyz");
  });

  it("builds the server client from public values only", async () => {
    const client = await createClient();

    expect(createServerClientMock).toHaveBeenCalledTimes(1);
    const [url, publishableKey] = createServerClientMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co");
    expect(publishableKey).toBe("sb_publishable_test");
    expect(JSON.stringify(createServerClientMock.mock.calls)).not.toContain(
      "sb_secret"
    );
    expect(client).toEqual({ __kind: "server-client" });
  });

  it("wires getAll to the request cookie store", async () => {
    await createClient();

    const adapter = getAdapter();
    expect(adapter.getAll()).toEqual([{ name: "existing", value: "1" }]);
    expect(cookieStore.getAll).toHaveBeenCalledTimes(1);
  });

  it("writes refreshed cookies through the store with their options", async () => {
    await createClient();

    getAdapter().setAll(
      [
        {
          name: "sb-example-auth-token",
          value: "refreshed",
          options: { path: "/", httpOnly: true },
        },
      ],
      { "Cache-Control": "no-store" }
    );

    expect(cookieStore.set).toHaveBeenCalledTimes(1);
    expect(cookieStore.set).toHaveBeenCalledWith("sb-example-auth-token", "refreshed", {
      path: "/",
      httpOnly: true,
    });
  });

  it("swallows cookie-write failures from Server Component context", async () => {
    await createClient();

    cookieStore.set.mockImplementationOnce(() => {
      throw new Error("Cookies can only be modified in a Server Action or Route Handler");
    });

    // The Proxy performs the actual writes on every request, so a failure
    // here must not break the render.
    expect(() =>
      getAdapter().setAll(
        [{ name: "sb-example-auth-token", value: "v", options: { path: "/" } }],
        {}
      )
    ).not.toThrow();
  });

  it("fails with a descriptive error when the public env is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    await expect(createClient()).rejects.toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(createServerClientMock).not.toHaveBeenCalled();
  });
});
