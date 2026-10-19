-- Haven Phase 2, Step 2: profiles table.
--
-- The profiles table is the per-account public identity record for Haven's
-- exactly-two provisioned accounts. It is intentionally minimal:
--
--   id           immutable, mirrors the auth.users identity (no separate
--                client-choosable identifier exists anywhere in Haven)
--   display_name the only user-editable field
--   created_at   protected from client mutation (column-level grant)
--   updated_at   maintained by trigger on every update
--
-- Lifecycle decisions (from the approved Phase 2 plan):
--   * Rows are created exclusively by the provisioning procedure (Step 4,
--     server-only, service-role). There is no client INSERT grant and no
--     INSERT policy, so an authenticated client can never create a profile.
--   * Deleting the auth.users row cascades and removes the profile. This is
--     the intentional deletion policy: the profile has no meaning without
--     its auth identity, and account teardown should not leave orphans.
--   * The two-account limit is NOT enforced here. Per the approved plan it is
--     enforced operationally plus a concurrency-safe DB guard introduced with
--     the provisioning script in Step 4, so that the guard and the only code
--     path that creates users ship together.
--   * devices/conversations/memberships and everything further arrive in
--     Step 3 migrations; nothing in this file anticipates them.
--
-- Privileges: Supabase grants new public tables to anon/authenticated/
-- service_role by default (see [api].auto_expose_new_tables and Supabase's
-- ALTER DEFAULT PRIVILEGES), so this migration explicitly revokes those and
-- re-grants the narrow intended surface. RLS is enabled even though the
-- grants alone would already deny anon, as defence in depth.

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on column public.profiles.id is
  'Immutable auth.users identifier; set at provisioning and not client-updatable.';
comment on column public.profiles.display_name is
  'Only profile field editable by the owning account.';

-- updated_at maintenance. Trigger functions run with the invoking role, and
-- trigger mutation of NEW does not require column privileges, so this works
-- under the column-level UPDATE grant below without widening it.
create function public.haven_set_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.haven_set_updated_at();

-- Lock the table down before attaching policies so the default Supabase
-- grants never describe the intended state. service_role retains the full
-- grant surface for trusted server-side administration only.
revoke all on table public.profiles from public;
revoke all on table public.profiles from anon;
revoke all on table public.profiles from authenticated;
grant all on table public.profiles to service_role;
grant select on table public.profiles to authenticated;
grant update (display_name) on table public.profiles to authenticated;

-- The trigger function is only reachable through the trigger, but restrict
-- direct execution anyway.
revoke execute on function public.haven_set_updated_at() from public;
revoke execute on function public.haven_set_updated_at() from anon;
revoke execute on function public.haven_set_updated_at() from authenticated;

alter table public.profiles enable row level security;

-- Deny by default: only these two policies exist. No INSERT policy (clients
-- cannot create profiles), no DELETE policy (clients cannot delete them),
-- no policies for anon or any other role. auth.uid() derives from the JWT
-- claims set by PostgREST, never from client-supplied request data.
create policy profiles_select_own on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
