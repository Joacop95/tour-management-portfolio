-- LOCAL TEST ONLY
-- DO NOT RUN ON REMOTE
-- NOT A MIGRATION
--
-- This scratch file is for local helper verification planning.
-- It does not enable RLS and does not create policies.
-- Most queries are commented because auth.uid() depends on authenticated
-- request context and SQL editor behavior may differ from browser sessions.

-- ---------------------------------------------------------------------------
-- 1. Confirm local profile and role mappings exist.
-- ---------------------------------------------------------------------------

-- select
--   profiles.email,
--   profiles.id as profile_id,
--   profiles.guide_id,
--   roles.role_key,
--   roles.name as role_name
-- from public.profiles
-- left join public.user_roles on user_roles.profile_id = profiles.id
-- left join public.roles on roles.id = user_roles.role_id
-- where lower(profiles.email) in (
--   'super-admin@test.local',
--   'admin@test.local',
--   'internal@test.local',
--   'guide@test.local'
-- )
-- order by profiles.email, roles.role_key;

-- ---------------------------------------------------------------------------
-- 2. Confirm seeded role permissions for each local persona.
-- ---------------------------------------------------------------------------

-- select
--   roles.role_key,
--   permissions.permission_key
-- from public.roles
-- join public.role_permissions on role_permissions.role_id = roles.id
-- join public.permissions on permissions.id = role_permissions.permission_id
-- where roles.role_key in (
--   'super-admin',
--   'admin-administrativo',
--   'consulta-interna',
--   'guide'
-- )
-- order by roles.role_key, permissions.permission_key;

-- ---------------------------------------------------------------------------
-- 3. Optional helper smoke test.
-- ---------------------------------------------------------------------------
-- These calls only return meaningful current-user values when the SQL is
-- executed in an authenticated request context. In SQL editor, auth.uid() may
-- be null or may not represent the browser user.

-- select auth.uid() as current_auth_uid;
-- select public.current_user_role_keys() as role_keys;
-- select public.current_user_permission_keys() as permission_keys;
-- select public.has_permission('groups.view') as has_groups_view;
-- select public.has_permission('settings.manage_roles_permissions') as has_role_management;
-- select public.current_user_guide_id() as guide_id;

-- ---------------------------------------------------------------------------
-- 4. Local cleanup if draft helpers were created for testing.
-- ---------------------------------------------------------------------------

-- drop function if exists public.has_permission(text);
-- drop function if exists public.current_user_permission_keys();
-- drop function if exists public.current_user_role_keys();
-- drop function if exists public.current_user_guide_id();
