-- RLS helper functions for local verification and future policy rollout.
--
-- This migration intentionally creates helper functions only:
-- - No RLS is enabled.
-- - No policies are created.
-- - No existing tables are modified.

create or replace function public.current_user_role_keys()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct roles.role_key order by roles.role_key), '{}'::text[])
  from public.user_roles
  join public.roles on roles.id = user_roles.role_id
  where user_roles.profile_id = auth.uid()
$$;

create or replace function public.current_user_permission_keys()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(distinct permissions.permission_key order by permissions.permission_key), '{}'::text[])
  from public.user_roles
  join public.role_permissions on role_permissions.role_id = user_roles.role_id
  join public.permissions on permissions.id = role_permissions.permission_id
  where user_roles.profile_id = auth.uid()
$$;

create or replace function public.has_permission(target_permission_key text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(target_permission_key = any(public.current_user_permission_keys()), false)
$$;

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

revoke all on function public.current_user_role_keys() from public;
revoke all on function public.current_user_permission_keys() from public;
revoke all on function public.has_permission(text) from public;
revoke all on function public.current_user_guide_id() from public;

grant execute on function public.current_user_role_keys() to authenticated;
grant execute on function public.current_user_permission_keys() to authenticated;
grant execute on function public.has_permission(text) to authenticated;
grant execute on function public.current_user_guide_id() to authenticated;

comment on function public.current_user_role_keys() is
  'Returns role keys for the authenticated profile using profiles.id = auth.uid(). Helper only; RLS is not enabled by this migration.';
comment on function public.current_user_permission_keys() is
  'Returns permission keys for the authenticated profile through user_roles, role_permissions, and permissions. Helper only; RLS is not enabled by this migration.';
comment on function public.has_permission(text) is
  'Checks whether the authenticated profile has a target permission key. Helper only; RLS is not enabled by this migration.';
comment on function public.current_user_guide_id() is
  'Returns the guide id linked to the authenticated profile, when present. Helper only; RLS is not enabled by this migration.';
