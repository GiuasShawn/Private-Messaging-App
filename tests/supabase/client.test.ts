// Unit tests for the browser Supabase client factory.
//
// The factory is mocked so no network or cookie machinery runs; the tests
// assert *which values* the browser client is built from — public values
// only, never the secret key.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createBrowserClientMock } = vi.hoisted(() => ({
  createBrowserClientMock: vi.fn(
    (_url: string, _publishableKey: string) => ({ __kind: "browser-client" })
  ),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: createBrowserClientMock,
}));

import { createClient } from "@/lib/supabase/client";

describe("lib/supabase/client (browser client)", () => {
  beforeEach(() => {
    createBrowserClientMock.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    // Canary: the secret key is present in the environment but must never
    // reach the browser client.
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_canary_value_xyz");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the browser client from public values only", () => {
    const client = createClient();

    expect(createBrowserClientMock).toHaveBeenCalledTimes(1);
    const [url, publishableKey] = createBrowserClientMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co");
    expect(publishableKey).toBe("sb_publishable_test");
    expect(client).toEqual({ __kind: "browser-client" });
  });

  it("never passes the secret key (or anything resembling it) to the factory", () => {
    createClient();

    const serializedCalls = JSON.stringify(createBrowserClientMock.mock.calls);
    expect(serializedCalls).not.toContain("sb_secret");
    expect(serializedCalls).not.toContain("SUPABASE_SECRET_KEY");
  });

  it("fails with a descriptive error when the public env is missing", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "");

    expect(() => createClient()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(createBrowserClientMock).not.toHaveBeenCalled();
  });
});
