// Haven database verification core (Phase 2, Step 2).
//
// Strategy
// --------
// Checks run against a local Supabase Postgres using the database owner
// connection (the `postgres` user of `supabase start`). The owner is exempt
// from RLS, so it is used ONLY for: (a) schema introspection, (b) creating
// and removing the two dedicated test identities, and (c) read-back of rows
// after a role-switched statement. Every access-control assertion executes
// inside its own transaction under `set local role` plus the
// `request.jwt.claims` GUC — the exact conditions PostgREST establishes for
// real API requests. The `auth.uid()` wiring check proves the claims GUC we
// drive is the one the policies' `auth.uid()` condition reads, so policy
// behaviour observed here is the behaviour a real authenticated request hits.
//
// Documented limitation: this exercises the RLS layer at the database, not
// the full HTTP path (GoTrue JWT validation, apikey handling, Data API
// schema exposure). Those layers are out of scope for Step 2 and are not
// claimed as verified here.
//
// This module is plain ESM so it can run under plain Node (scripts/verify-db.mjs)
// and be unit-tested directly (tests/db/verify-runner.test.ts).

export class PrereqError extends Error {
  constructor(message) {
    super(message);
    this.name = "PrereqError";
  }
}

// Deterministic identities, scoped to this runner so cleanup can never touch
// anything else. Emails use the reserved .invalid TLD.
export const TEST_USER_A = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "haven-verify-user-a@example.invalid",
  displayName: "Haven Verifier A",
};

export const TEST_USER_B = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "haven-verify-user-b@example.invalid",
  displayName: "Haven Verifier B",
};

const TEST_EMAILS = [TEST_USER_A.email, TEST_USER_B.email];

export function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

// Awaits a statement that MUST be rejected, and verifies the rejection is the
// intended permission failure rather than an unrelated error or a success.
export async function assertDenied(statement, pattern, what) {
  try {
    await statement;
  } catch (error) {
    if (pattern.test(error.message)) {
      return;
    }
    throw new Error(`${what}: expected a permission error matching ${pattern}, got: ${error.message}`);
  }
  throw new Error(`${what}: expected the statement to be denied, but it succeeded`);
}

export async function withTransaction(client, fn) {
  await client.query("begin");
  try {
    const value = await fn();
    await client.query("rollback");
    return value;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      // The rollback failure must not mask the original assertion error.
    }
    throw error;
  }
}

// Mirrors what PostgREST does for an authenticated API request: switch to the
// `authenticated` database role and set the JWT claims GUC that auth.uid()
// and policy conditions read. All claims are fixed strings or deterministic
// UUIDs owned by this runner; values are passed via set_config parameters.
export async function asAuthenticated(client, userId, fn) {
  await client.query("set local role authenticated");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ sub: userId, role: "authenticated" }),
  ]);
  return fn();
}

export async function asAnonymous(client, fn) {
  await client.query("set local role anon");
  await client.query("select set_config('request.jwt.claims', $1, true)", [
    JSON.stringify({ role: "anon" }),
  ]);
  return fn();
}

export async function asServiceRole(client, fn) {
  await client.query("set local role service_role");
  return fn();
}

export async function removeTestArtifacts(client) {
  await client.query("delete from auth.users where email = any($1)", [TEST_EMAILS]);
}

export async function seedTestUsers(client) {
  for (const user of [TEST_USER_A, TEST_USER_B]) {
    // Minimal auth.users row: only columns present in every recent Supabase
    // auth schema. The profile row is still created explicitly rather than
    // relying on any trigger, so this runner never depends on Step 4
    // provisioning behaviour.
    await client.query("insert into auth.users (id, email) values ($1, $2)", [user.id, user.email]);
    await client.query("insert into public.profiles (id, display_name) values ($1, $2)", [
      user.id,
      user.displayName,
    ]);
  }
}

export async function ensurePrerequisites(client) {
  const { rows } = await client.query(
    "select to_regclass('auth.users') as auth_users, to_regclass('public.profiles') as profiles, to_regprocedure('auth.uid()') as auth_uid",
  );
  const row = rows[0] ?? {};
  if (row.auth_users === null || row.auth_users === undefined) {
    throw new PrereqError(
      "auth.users not found - this does not look like a Supabase local database. Start one with: npx supabase start",
    );
  }
  if (row.auth_uid === null || row.auth_uid === undefined) {
    throw new PrereqError("auth.uid() not found - the local Supabase auth schema is incomplete. Restart the stack: npx supabase stop && npx supabase start");
  }
  if (row.profiles === null || row.profiles === undefined) {
    throw new PrereqError(
      "public.profiles not found - migrations are not applied. Apply them with: npx supabase db reset",
    );
  }
}

// ---------------------------------------------------------------------------
// Schema checks (introspection only; run as the RLS-exempt owner).
// ---------------------------------------------------------------------------

async function checkColumns(client) {
  const { rows } = await client.query(
    `select column_name, data_type, is_nullable, column_default
     from information_schema.columns
     where table_schema = 'public' and table_name = 'profiles'
     order by column_name`,
  );
  const byName = Object.fromEntries(rows.map((row) => [row.column_name, row]));
  const expected = ["id", "display_name", "created_at", "updated_at"];
  assert(
    rows.length === expected.length && expected.every((name) => name in byName),
    `expected exactly the columns [${expected.join(", ")}], got [${rows.map((r) => r.column_name).join(", ")}]`,
  );
  assert(byName.id.data_type === "uuid", `id must be uuid, got ${byName.id.data_type}`);
  assert(byName.display_name.data_type === "text", `display_name must be text, got ${byName.display_name.data_type}`);
  for (const name of expected) {
    assert(byName[name].is_nullable === "NO", `${name} must be NOT NULL`);
  }
  assert(
    String(byName.created_at.column_default).includes("now()"),
    "created_at must default to now()",
  );
  assert(
    String(byName.updated_at.column_default).includes("now()"),
    "updated_at must default to now()",
  );
}

async function checkPrimaryKey(client) {
  const { rows } = await client.query(
    `select kcu.column_name
     from information_schema.table_constraints tc
     join information_schema.key_column_usage kcu
       on kcu.constraint_name = tc.constraint_name
      and kcu.table_schema = tc.table_schema
     where tc.table_schema = 'public' and tc.table_name = 'profiles'
       and tc.constraint_type = 'PRIMARY KEY'
     order by kcu.ordinal_position`,
  );
  assert(
    rows.length === 1 && rows[0].column_name === "id",
    `expected a single-column primary key on id, got [${rows.map((r) => r.column_name).join(", ")}]`,
  );
}

async function checkForeignKey(client) {
  // pg_catalog rather than information_schema: constraint_column_usage rows
  // for a foreign key describe the REFERENCED columns, so their table_schema
  // is the target schema (`auth` here), and the classic
  // `ccu.table_schema = tc.table_schema` join silently matches nothing for
  // cross-schema references. pg_constraint states the reference directly.
  const { rows } = await client.query(
    `select case c.confdeltype
              when 'c' then 'CASCADE'
              when 'r' then 'RESTRICT'
              when 'n' then 'SET NULL'
              when 'd' then 'SET DEFAULT'
              when 'a' then 'NO ACTION'
            end as delete_rule,
            fn.nspname as foreign_schema,
            frel.relname as foreign_table,
            fcol.attname as foreign_column
     from pg_constraint c
     join pg_class crel on crel.oid = c.conrelid
     join pg_namespace cns on cns.oid = crel.relnamespace
     join pg_class frel on frel.oid = c.confrelid
     join pg_namespace fn on fn.oid = frel.relnamespace
     join pg_attribute fcol
       on fcol.attrelid = c.confrelid
      and fcol.attnum = c.confkey[1]
     where c.contype = 'f'
       and cns.nspname = 'public'
       and crel.relname = 'profiles'`,
  );
  assert(rows.length === 1, `expected exactly one foreign key, got ${rows.length}`);
  assert(
    rows[0].foreign_schema === "auth" &&
      rows[0].foreign_table === "users" &&
      rows[0].foreign_column === "id",
    `foreign key must reference auth.users(id), got ${rows[0].foreign_schema}.${rows[0].foreign_table}(${rows[0].foreign_column})`,
  );
  assert(
    rows[0].delete_rule === "CASCADE",
    `deletion policy must be ON DELETE CASCADE, got ${rows[0].delete_rule}`,
  );
}

async function checkDisplayNameConstraint(client) {
  const { rows } = await client.query(
    `select pg_get_constraintdef(oid) as definition
     from pg_constraint
     where conrelid = 'public.profiles'::regclass and contype = 'c'`,
  );
  assert(rows.length === 1, `expected exactly one check constraint on profiles, got ${rows.length}`);
  const definition = rows[0].definition;
  assert(
    definition.includes("char_length") && definition.includes("display_name") && definition.includes("64"),
    `check constraint must bound display_name length to 64 characters, got: ${definition}`,
  );
}

async function checkRowLevelSecurityEnabled(client) {
  const { rows } = await client.query(
    "select relrowsecurity as enabled from pg_class where oid = 'public.profiles'::regclass",
  );
  assert(rows.length === 1 && rows[0].enabled === true, "RLS must be enabled on public.profiles");
}

async function checkPolicyInventory(client) {
  const { rows } = await client.query(
    `select policyname, cmd, roles::text[] as roles, with_check
     from pg_policies
     where schemaname = 'public' and tablename = 'profiles'
     order by policyname`,
  );
  assert(
    rows.length === 2,
    `expected exactly 2 policies on profiles (deny by default), got ${rows.length}: [${rows.map((r) => `${r.policyname}:${r.cmd}`).join(", ")}]`,
  );
  for (const row of rows) {
    assert(
      Array.isArray(row.roles) && row.roles.length === 1 && row.roles[0] === "authenticated",
      `policy ${row.policyname} must target the authenticated role only, got [${(row.roles ?? []).join(", ")}]`,
    );
  }
  // pg_policies.cmd is uppercase in modern PostgreSQL ('SELECT'/'UPDATE'),
  // but was lowercase in older versions; compare case-insensitively.
  const selectPolicy = rows.find((r) => String(r.cmd).toLowerCase() === "select");
  const updatePolicy = rows.find((r) => String(r.cmd).toLowerCase() === "update");
  assert(selectPolicy, "missing the SELECT policy");
  assert(updatePolicy, "missing the UPDATE policy");
  assert(updatePolicy.with_check, "UPDATE policy must define WITH CHECK");
  // No INSERT/DELETE/TRUNCATE policies exist because the count assertion
  // above is exactly 2 and both are accounted for.
}

async function checkUpdatedTrigger(client) {
  const { rows } = await client.query(
    `select tgname, tgenabled, tgisinternal
     from pg_trigger
     where tgrelid = 'public.profiles'::regclass and tgname = 'profiles_set_updated_at'`,
  );
  assert(rows.length === 1, "missing the profiles_set_updated_at trigger");
  assert(rows[0].tgisinternal === false, "updated_at trigger must not be an internal constraint trigger");
  assert(rows[0].tgenabled === "O", `updated_at trigger must be enabled (always), got ${rows[0].tgenabled}`);
}

async function checkGrants(client) {
  const { rows } = await client.query(
    `select
       has_table_privilege('anon', 'public.profiles', 'select') as anon_select,
       has_table_privilege('anon', 'public.profiles', 'insert') as anon_insert,
       has_table_privilege('anon', 'public.profiles', 'update') as anon_update,
       has_table_privilege('anon', 'public.profiles', 'delete') as anon_delete,
       has_table_privilege('authenticated', 'public.profiles', 'select') as auth_select,
       has_table_privilege('authenticated', 'public.profiles', 'insert') as auth_insert,
       has_table_privilege('authenticated', 'public.profiles', 'delete') as auth_delete,
       has_table_privilege('authenticated', 'public.profiles', 'truncate') as auth_truncate,
       has_column_privilege('authenticated', 'public.profiles', 'display_name', 'update') as auth_update_display_name,
       has_column_privilege('authenticated', 'public.profiles', 'id', 'update') as auth_update_id,
       has_column_privilege('authenticated', 'public.profiles', 'created_at', 'update') as auth_update_created_at,
       has_table_privilege('service_role', 'public.profiles', 'insert') as service_insert`,
  );
  const g = rows[0];
  assert(!g.anon_select && !g.anon_insert && !g.anon_update && !g.anon_delete, "anon must hold no privileges on profiles");
  assert(g.auth_select, "authenticated must be able to SELECT profiles");
  assert(!g.auth_insert && !g.auth_delete && !g.auth_truncate, "authenticated must not hold INSERT/DELETE/TRUNCATE on profiles");
  assert(g.auth_update_display_name, "authenticated must be able to UPDATE display_name");
  assert(!g.auth_update_id && !g.auth_update_created_at, "authenticated must not be able to UPDATE id or created_at");
  assert(g.service_insert, "service_role must retain INSERT for trusted provisioning");
}

// ---------------------------------------------------------------------------
// Behavioural RLS checks. Each runs in its own rolled-back transaction under
// the same role/claims conditions PostgREST establishes for real requests.
// ---------------------------------------------------------------------------

async function checkAuthUidWiring(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      const { rows } = await client.query("select auth.uid() as uid");
      assert(
        rows[0]?.uid != null && String(rows[0].uid).toLowerCase() === TEST_USER_A.id,
        `auth.uid() must resolve the claims sub we set; got ${rows[0]?.uid}`,
      );
    });
  });
}

async function checkReadOwnProfile(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      const { rows } = await client.query(
        "select id, display_name from public.profiles where id = $1",
        [TEST_USER_A.id],
      );
      assert(rows.length === 99, `own profile must be visible, got ${rows.length} rows`);
      assert(
        rows[0].display_name === TEST_USER_A.displayName,
        `own display_name must be readable, got ${rows[0].display_name}`,
      );
    });
  });
}

async function checkCrossAccountIsolation(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      const { rows } = await client.query(
        "select id from public.profiles where id = $1",
        [TEST_USER_B.id],
      );
      assert(rows.length === 0, `user A must not see user B's profile, got ${rows.length} rows`);
      const { rows: visible } = await client.query("select id from public.profiles");
      assert(
        visible.length === 1 && visible[0].id === TEST_USER_A.id,
        `user A must see exactly their own profile, got ${visible.length} rows`,
      );
    });
  });
}

async function checkUpdateOwnDisplayName(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      const result = await client.query(
        "update public.profiles set display_name = $1 where id = $2",
        ["Haven Verifier A (renamed)", TEST_USER_A.id],
      );
      assert(result.rowCount === 1, `own display_name update must affect 1 row, got ${result.rowCount}`);
    });
    await client.query("reset role");
    const { rows } = await client.query(
      "select display_name, created_at, updated_at from public.profiles where id = $1",
      [TEST_USER_A.id],
    );
    assert(rows[0].display_name === "Haven Verifier A (renamed)", "renamed display_name must persist in the row");
    assert(
      new Date(rows[0].updated_at).getTime() > new Date(rows[0].created_at).getTime(),
      "updated_at must move forward on update (trigger)",
    );
  });
}

async function checkCannotUpdateCreatedAt(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      await assertDenied(
        client.query("update public.profiles set created_at = now() where id = $1", [TEST_USER_A.id]),
        /permission denied/,
        "updating created_at must be denied",
      );
    });
  });
}

async function checkCannotChangeOwnerId(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      await assertDenied(
        client.query("update public.profiles set id = $1 where id = $2", [TEST_USER_B.id, TEST_USER_A.id]),
        /permission denied/,
        "changing the profile id must be denied (ownership is immutable)",
      );
    });
  });
}

async function checkCannotUpdateOtherProfile(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      const result = await client.query(
        "update public.profiles set display_name = 'pwned' where id = $1",
        [TEST_USER_B.id],
      );
      assert(result.rowCount === 0, `updating B's profile as A must affect 0 rows, got ${result.rowCount}`);
    });
    await client.query("reset role");
    const { rows } = await client.query("select display_name from public.profiles where id = $1", [
      TEST_USER_B.id,
    ]);
    assert(
      rows[0].display_name === TEST_USER_B.displayName,
      `B's profile must be unchanged, got ${rows[0].display_name}`,
    );
  });
}

async function checkCannotInsertProfile(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      await assertDenied(
        client.query("insert into public.profiles (id, display_name) values ($1, 'intruder')", [TEST_USER_B.id]),
        /permission denied/,
        "inserting a profile must be denied (provisioning is service-role only)",
      );
    });
  });
}

async function checkCannotDeleteProfile(client) {
  await withTransaction(client, async () => {
    await asAuthenticated(client, TEST_USER_A.id, async () => {
      await assertDenied(
        client.query("delete from public.profiles where id = $1", [TEST_USER_A.id]),
        /permission denied/,
        "deleting a profile must be denied",
      );
    });
  });
}

async function checkAnonymousDeniedRead(client) {
  await withTransaction(client, async () => {
    await asAnonymous(client, async () => {
      await assertDenied(
        client.query("select id from public.profiles"),
        /permission denied/,
        "unauthenticated reads must be denied",
      );
    });
  });
}

async function checkAnonymousDeniedWrite(client) {
  await withTransaction(client, async () => {
    await asAnonymous(client, async () => {
      await assertDenied(
        client.query("insert into public.profiles (id, display_name) values ($1, 'intruder')", [TEST_USER_A.id]),
        /permission denied/,
        "unauthenticated writes must be denied",
      );
    });
  });
}

// Control: service_role (RLS-bypassing) sees both seeded rows. This proves
// the empty cross-account/anonymous results above come from the policies,
// not from missing data.
async function checkServiceRoleSeesBoth(client) {
  await withTransaction(client, async () => {
    await asServiceRole(client, async () => {
      const { rows } = await client.query("select id from public.profiles");
      const ids = new Set(rows.map((r) => String(r.id)));
      assert(
        ids.size === 2 && ids.has(TEST_USER_A.id) && ids.has(TEST_USER_B.id),
        `service_role control must see both test profiles, got ${rows.length} rows`,
      );
    });
  });
}

export const SCHEMA_CHECKS = [
  { name: "schema: profiles columns and types", run: checkColumns },
  { name: "schema: primary key on id", run: checkPrimaryKey },
  { name: "schema: foreign key to auth.users with ON DELETE CASCADE", run: checkForeignKey },
  { name: "schema: display_name length check constraint", run: checkDisplayNameConstraint },
  { name: "schema: row level security enabled", run: checkRowLevelSecurityEnabled },
  { name: "schema: exactly two narrow policies (select/update, authenticated)", run: checkPolicyInventory },
  { name: "schema: updated_at trigger present and enabled", run: checkUpdatedTrigger },
  { name: "schema: least-privilege grants (anon empty, authenticated read+rename only)", run: checkGrants },
];

export const BEHAVIOUR_CHECKS = [
  { name: "rls: auth.uid() resolves the request claims sub", run: checkAuthUidWiring },
  { name: "rls: user can read their own profile", run: checkReadOwnProfile },
  { name: "rls: user cannot read another user's profile (cross-account isolation)", run: checkCrossAccountIsolation },
  { name: "rls: user can update their own display_name (updated_at trigger fires)", run: checkUpdateOwnDisplayName },
  { name: "rls: user cannot modify created_at", run: checkCannotUpdateCreatedAt },
  { name: "rls: user cannot change the profile id (immutable ownership)", run: checkCannotChangeOwnerId },
  { name: "rls: user cannot update another user's profile", run: checkCannotUpdateOtherProfile },
  { name: "rls: user cannot insert profiles (provisioning is service-role only)", run: checkCannotInsertProfile },
  { name: "rls: user cannot delete profiles", run: checkCannotDeleteProfile },
  { name: "rls: unauthenticated reads are denied", run: checkAnonymousDeniedRead },
  { name: "rls: unauthenticated writes are denied", run: checkAnonymousDeniedWrite },
  { name: "control: service_role sees both test profiles (isolated results are policy-driven)", run: checkServiceRoleSeesBoth },
];

export const ALL_CHECKS = [...SCHEMA_CHECKS, ...BEHAVIOUR_CHECKS];

// Executes checks sequentially, recording per-check results without aborting
// the run. Test identities are removed before and after the run regardless of
// outcomes, so the runner never leaves data behind and never depends on a
// pre-populated database.
export async function runVerification({ createClient, checks = ALL_CHECKS, log = console.log }) {
  let client;
  try {
    client = await createClient();
  } catch (error) {
    throw new PrereqError(`could not connect to the database: ${error.message}`);
  }

  const results = [];
  try {
    await ensurePrerequisites(client);
    await removeTestArtifacts(client);
    await seedTestUsers(client);

    for (const check of checks) {
      try {
        await check.run(client);
        results.push({ name: check.name, ok: true });
        log(`  \u2713 ${check.name}`);
      } catch (error) {
        results.push({ name: check.name, ok: false, error: error.message });
        log(`  \u2717 ${check.name}\n      ${error.message}`);
      }
    }
  } finally {
    try {
      await removeTestArtifacts(client);
    } catch (error) {
      results.push({ name: "cleanup: test identities removed", ok: false, error: error.message });
      log(`  \u2717 cleanup: test identities removed\n      ${error.message}`);
    }
    await client.end?.();
  }
  return results;
}
