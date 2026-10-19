-- DRAFT ONLY
-- DO NOT RUN YET
-- NOT A MIGRATION
--
-- This file sketches initial RLS helpers and a few low-risk example policies.
-- It is intentionally not placed in supabase/migrations.
-- Review, test locally, and convert to staged migrations only after policy
-- coverage is complete.

-- ---------------------------------------------------------------------------
-- Helper function drafts
-- ---------------------------------------------------------------------------

-- Returns role keys mapped to the current authenticated profile.
create or replace function public.current_user_role_keys()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct roles.role_key), '{}'::text[])
  from public.user_roles
  join public.roles on roles.id = user_roles.role_id
  where user_roles.profile_id = auth.uid()
$$;

-- Returns permission keys mapped to the current authenticated profile.
create or replace function public.current_user_permission_keys()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct permissions.permission_key), '{}'::text[])
  from public.user_roles
  join public.role_permissions on role_permissions.role_id = user_roles.role_id
  join public.permissions on permissions.id = role_permissions.permission_id
  where user_roles.profile_id = auth.uid()
$$;

-- Checks whether the current authenticated user has a permission key.
create or replace function public.has_permission(permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select permission_key = any(public.current_user_permission_keys())
$$;

-- Optional helper for guide-scoped policies.
create or replace function public.current_user_guide_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select profiles.guide_id
  from public.profiles
  where profiles.id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Example policies only
-- ---------------------------------------------------------------------------
-- These examples intentionally cover only low-risk/read-oriented policy shapes.
-- Do not run them until the helper functions are reviewed and RLS rollout starts.

-- Example: profiles self-read.
-- alter table public.profiles enable row level security;
-- create policy "profiles_select_self"
-- on public.profiles
-- for select
-- to authenticated
-- using (
--   id = auth.uid()
--   or public.has_permission('settings.manage_roles_permissions')
-- );

-- Example: roles read for authenticated users.
-- alter table public.roles enable row level security;
-- create policy "roles_select_authenticated"
-- on public.roles
-- for select
-- to authenticated
-- using (true);

-- Example: permissions read for authenticated users.
-- alter table public.permissions enable row level security;
-- create policy "permissions_select_authenticated"
-- on public.permissions
-- for select
-- to authenticated
-- using (true);

-- Example local rollback if a table breaks during testing:
-- alter table public.profiles disable row level security;
-- alter table public.roles disable row level security;
-- alter table public.permissions disable row level security;
