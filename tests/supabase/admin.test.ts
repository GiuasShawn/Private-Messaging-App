// Unit tests for the admin Supabase client factory.
//
// The admin client is the only application module allowed to read the
// secret key; these tests pin down that it reads exactly the server env,
// that it refuses to build without it, and that it never receives the
// publishable key in the secret position.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createSupabaseClientMock } = vi.hoisted(() => ({
  createSupabaseClientMock: vi.fn(
    (_url: string, _key: string, _options: unknown) => ({
      __kind: "admin-client",
    })
  ),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClientMock,
}));

import { createAdminClient } from "@/lib/supabase/admin";

describe("lib/supabase/admin (admin client)", () => {
  beforeEach(() => {
    createSupabaseClientMock.mockClear();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_test");
    vi.stubEnv("SUPABASE_SECRET_KEY", "sb_secret_server_only_value");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds the client with the secret key and disables session persistence", () => {
    const client = createAdminClient();

    expect(createSupabaseClientMock).toHaveBeenCalledTimes(1);
    const [url, key, options] = createSupabaseClientMock.mock.calls[0];
    expect(url).toBe("https://example.supabase.co");
    expect(key).toBe("sb_secret_server_only_value");
    expect(options).toEqual({
      auth: { autoRefreshToken: false, persistSession: false },
    });
    expect(client).toEqual({ __kind: "admin-client" });
  });

  it("accepts the SUPABASE_URL alias for operator scripts", () => {
    vi.stubEnv("SUPABASE_URL", "https://alias.supabase.co");

    createAdminClient();

    const [url] = createSupabaseClientMock.mock.calls[0];
    expect(url).toBe("https://alias.supabase.co");
  });

  it("refuses to build without the secret key", () => {
    vi.stubEnv("SUPABASE_SECRET_KEY", undefined);

    expect(() => createAdminClient()).toThrow(/SUPABASE_SECRET_KEY/);
    expect(createSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("refuses to build without a project URL", () => {
    vi.stubEnv("SUPABASE_URL", undefined);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");

    expect(() => createAdminClient()).toThrow(/SUPABASE_URL/);
    expect(createSupabaseClientMock).not.toHaveBeenCalled();
  });

  it("never passes the publishable key in the secret position", () => {
    createAdminClient();

    const [, key] = createSupabaseClientMock.mock.calls[0];
    expect(key).not.toContain("publishable");
  });
});
