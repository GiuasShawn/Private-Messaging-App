// Unit tests for the database verification runner's mechanics (Phase 2,
// Step 2). These cover the parts that must be provably correct without a
// live database: transaction hygiene, PostgREST-equivalent role/claims
// session setup, denial assertions, prerequisite reporting, per-check
// aggregation, and test-data cleanup invariants. The schema and behavioural
// checks themselves are exercised against a real local Supabase in CI
// (`npm run verify:db` after `npx supabase db reset`).
import { describe, expect, it, vi } from "vitest";

import {
  ALL_CHECKS,
  PrereqError,
  TEST_USER_A,
  assertDenied,
  asAnonymous,
  asAuthenticated,
  asServiceRole,
  ensurePrerequisites,
  runVerification,
  withTransaction,
} from "../../scripts/lib/db-verify-core.mjs";

type Handler = {
  match: RegExp;
  respond: (callsSoFar: number) => unknown;
};

function createFakeClient(handlers: Handler[]) {
  const calls: Array<{ text: string; params?: unknown[] }> = [];
  const counters = new Map<Handler, number>();
  return {
    calls,
    end: vi.fn(),
    async query(text: string, params?: unknown[]) {
      calls.push({ text, params });
      const handler = handlers.find((candidate) => candidate.match.test(text));
      if (!handler) {
        throw new Error(`unexpected query: ${text}`);
      }
      const count = (counters.get(handler) ?? 0) + 1;
      counters.set(handler, count);
      const response = handler.respond(count);
      if (response instanceof Error) {
        throw response;
      }
      return response;
    },
  };
}

const OK_RESULT = { rows: [] as Record<string, unknown>[], rowCount: 0 };

// Handlers that satisfy the runner's lifecycle queries (prerequisites ok,
// cleanup and seeding succeed).
function lifecycleHandlers(): Handler[] {
  return [
    {
      match: /to_regclass\('auth\.users'\)/,
      respond: () => ({
        rows: [{ auth_users: "auth.users", profiles: "public.profiles", auth_uid: "auth.uid()" }],
      }),
    },
    { match: /delete from auth\.users/, respond: () => ({ ...OK_RESULT, rowCount: 0 }) },
    { match: /insert into auth\.users/, respond: () => ({ ...OK_RESULT, rowCount: 1 }) },
    { match: /insert into public\.profiles/, respond: () => ({ ...OK_RESULT, rowCount: 1 }) },
  ];
}

describe("withTransaction", () => {
  it("rolls back after a successful body", async () => {
    const client = createFakeClient([{ match: /[\s\S]*/, respond: () => OK_RESULT }]);
    await withTransaction(client as never, async () => "done");
    expect(client.calls.map((c) => c.text)).toEqual(["begin", "rollback"]);
  });

  it("rolls back and rethrows when the body fails", async () => {
    const client = createFakeClient([{ match: /[\s\S]*/, respond: () => OK_RESULT }]);
    await expect(
      withTransaction(client as never, async () => {
        throw new Error("assertion failed");
      }),
    ).rejects.toThrow("assertion failed");
    expect(client.calls.map((c) => c.text)).toEqual(["begin", "rollback"]);
  });
});

describe("role and claims session helpers", () => {
  it("asAuthenticated mirrors PostgREST: role switch plus claims GUC with sub", async () => {
    const client = createFakeClient([{ match: /[\s\S]*/, respond: () => OK_RESULT }]);
    await asAuthenticated(client as never, TEST_USER_A.id, async () => undefined);
    expect(client.calls[0].text).toBe("set local role authenticated");
    expect(client.calls[1].text).toContain("set_config('request.jwt.claims'");
    expect(client.calls[1].params).toEqual([JSON.stringify({ sub: TEST_USER_A.id, role: "authenticated" })]);
  });

  it("asAnonymous sets the anon role and anon claims", async () => {
    const client = createFakeClient([{ match: /[\s\S]*/, respond: () => OK_RESULT }]);
    await asAnonymous(client as never, async () => undefined);
    expect(client.calls[0].text).toBe("set local role anon");
    expect(client.calls[1].params).toEqual([JSON.stringify({ role: "anon" })]);
  });

  it("asServiceRole only switches role", async () => {
    const client = createFakeClient([{ match: /[\s\S]*/, respond: () => OK_RESULT }]);
    await asServiceRole(client as never, async () => undefined);
    expect(client.calls.map((c) => c.text)).toEqual(["set local role service_role"]);
  });
});

describe("assertDenied", () => {
  it("passes when the statement fails with a permission error", async () => {
    await expect(
      assertDenied(
        Promise.reject(new Error("permission denied for table profiles")),
        /permission denied/,
        "reading",
      ),
    ).resolves.toBeUndefined();
  });

  it("fails when the statement unexpectedly succeeds", async () => {
    await expect(assertDenied(Promise.resolve({}), /permission denied/, "reading")).rejects.toThrow(
      /expected the statement to be denied, but it succeeded/,
    );
  });

  it("fails when the error is not the expected permission error", async () => {
    await expect(
      assertDenied(Promise.reject(new Error("syntax error")), /permission denied/, "reading"),
    ).rejects.toThrow(/expected a permission error matching/);
  });
});

describe("ensurePrerequisites", () => {
  it("reports a non-Supabase database", async () => {
    const client = createFakeClient([
      {
        match: /to_regclass\('auth\.users'\)/,
        respond: () => ({ rows: [{ auth_users: null, profiles: null, auth_uid: null }] }),
      },
    ]);
    await expect(ensurePrerequisites(client as never)).rejects.toThrow(PrereqError);
    await expect(ensurePrerequisites(client as never)).rejects.toThrow(/npx supabase start/);
  });

  it("reports migrations that have not been applied", async () => {
    const client = createFakeClient([
      {
        match: /to_regclass\('auth\.users'\)/,
        respond: () => ({ rows: [{ auth_users: "auth.users", profiles: null, auth_uid: "auth.uid()" }] }),
      },
    ]);
    await expect(ensurePrerequisites(client as never)).rejects.toThrow(/npx supabase db reset/);
  });

  it("passes on a migrated local Supabase database", async () => {
    const client = createFakeClient(lifecycleHandlers());
    await expect(ensurePrerequisites(client as never)).resolves.toBeUndefined();
  });
});

describe("runVerification", () => {
  it("wraps connection failures as prerequisite errors", async () => {
    await expect(
      runVerification({
        createClient: async () => {
          throw new Error("ECONNREFUSED");
        },
        log: () => undefined,
      }),
    ).rejects.toThrow(/could not connect to the database: ECONNREFUSED/);
  });

  it("propagates prerequisite failures and still closes the client", async () => {
    const client = createFakeClient([
      {
        match: /to_regclass\('auth\.users'\)/,
        respond: () => ({ rows: [{ auth_users: "auth.users", profiles: null, auth_uid: "auth.uid()" }] }),
      },
      { match: /delete from auth\.users/, respond: () => ({ ...OK_RESULT, rowCount: 0 }) },
    ]);
    await expect(
      runVerification({ createClient: async () => client as never, log: () => undefined }),
    ).rejects.toThrow(PrereqError);
    expect(client.end).toHaveBeenCalled();
  });

  it("aggregates per-check results without aborting the run", async () => {
    const client = createFakeClient(lifecycleHandlers());
    const results = await runVerification({
      createClient: async () => client as never,
      checks: [
        { name: "passes", run: async () => undefined },
        {
          name: "fails",
          run: async () => {
            throw new Error("boom");
          },
        },
        { name: "also passes", run: async () => undefined },
      ],
      log: () => undefined,
    });
    expect(results).toEqual([
      { name: "passes", ok: true },
      { name: "fails", ok: false, error: "boom" },
      { name: "also passes", ok: true },
    ]);
  });

  it("removes test identities before and after the run, and closes the client", async () => {
    const client = createFakeClient(lifecycleHandlers());
    await runVerification({
      createClient: async () => client as never,
      checks: [{ name: "passes", run: async () => undefined }],
      log: () => undefined,
    });
    const cleanupCalls = client.calls.filter((c) => /delete from auth\.users/.test(c.text));
    expect(cleanupCalls).toHaveLength(2);
    expect(client.end).toHaveBeenCalledTimes(1);
  });

  it("records cleanup failures as a failed result", async () => {
    const client = createFakeClient([
      {
        match: /to_regclass\('auth\.users'\)/,
        respond: () => ({
          rows: [{ auth_users: "auth.users", profiles: "public.profiles", auth_uid: "auth.uid()" }],
        }),
      },
      { match: /insert into auth\.users/, respond: () => ({ ...OK_RESULT, rowCount: 1 }) },
      { match: /insert into public\.profiles/, respond: () => ({ ...OK_RESULT, rowCount: 1 }) },
      {
        match: /delete from auth\.users/,
        respond: (callsSoFar: number) =>
          callsSoFar === 1 ? { ...OK_RESULT, rowCount: 0 } : new Error("cleanup exploded"),
      },
    ]);
    const results = await runVerification({
      createClient: async () => client as never,
      checks: [{ name: "passes", run: async () => undefined }],
      log: () => undefined,
    });
    const cleanup = results.find((r) => r.name.includes("cleanup"));
    expect(cleanup).toEqual({ name: expect.stringContaining("cleanup"), ok: false, error: "cleanup exploded" });
  });
});

describe("check inventory", () => {
  it("ships the full Step 2 schema and RLS check set", () => {
    const names = ALL_CHECKS.map((check) => check.name);
    expect(names).toHaveLength(20);
    expect(new Set(names).size).toBe(names.length);
    expect(names.filter((n) => n.startsWith("schema:"))).toHaveLength(8);
    expect(names.filter((n) => n.startsWith("rls:") || n.startsWith("control:"))).toHaveLength(12);
  });
});
