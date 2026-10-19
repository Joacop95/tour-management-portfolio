-- Local development only.
-- Run manually after creating test users in local Supabase Studio Auth.
-- Not for production.
--
-- This helper maps manually created auth.users rows to public.profiles and
-- public.user_roles. It does not create auth users, passwords, RLS policies,
-- or real production access.
--
-- Suggested local Auth test users to create manually first:
-- - super-admin@test.local
-- - admin@test.local
-- - internal@test.local
-- - guide@test.local
--
-- Do not commit real passwords, service_role keys, anon keys, database URLs,
-- or production user IDs.

with auth_profiles as (
  select
    auth_users.id,
    lower(auth_users.email) as email,
    case lower(auth_users.email)
      when 'super-admin@test.local' then 'Super Admin Test'
      when 'admin@test.local' then 'Admin Administrativo Test'
      when 'internal@test.local' then 'Consulta Interna Test'
      when 'guide@test.local' then 'Guide Test'
    end as full_name,
    case lower(auth_users.email)
      when 'guide@test.local' then (
        select guides.id
        from public.guides
        where guides.is_archived = false
        order by guides.created_at asc
        limit 1
      )
      else null
    end as guide_id
  from auth.users as auth_users
  where lower(auth_users.email) in (
    'super-admin@test.local',
    'admin@test.local',
    'internal@test.local',
    'guide@test.local'
  )
)
insert into public.profiles (
  id,
  email,
  full_name,
  guide_id,
  created_at,
  updated_at
)
select
  auth_profiles.id,
  auth_profiles.email,
  auth_profiles.full_name,
  auth_profiles.guide_id,
  now(),
  now()
from auth_profiles
on conflict (id) do update
set
  email = excluded.email,
  full_name = excluded.full_name,
  guide_id = excluded.guide_id,
  updated_at = now();

with role_mapping as (
  select 'super-admin@test.local'::text as email, 'super-admin'::text as role_key
  union all
  select 'admin@test.local', 'admin-administrativo'
  union all
  select 'internal@test.local', 'consulta-interna'
  union all
  select 'guide@test.local', 'guide'
),
profile_roles as (
  select
    profiles.id as profile_id,
    roles.id as role_id
  from role_mapping
  join public.profiles as profiles
    on lower(profiles.email) = role_mapping.email
  join public.roles as roles
    on roles.role_key = role_mapping.role_key
)
insert into public.user_roles (
  profile_id,
  role_id,
  created_at,
  updated_at
)
select
  profile_roles.profile_id,
  profile_roles.role_id,
  now(),
  now()
from profile_roles
on conflict (profile_id, role_id) do nothing;

-- Verification query:
select
  profiles.email,
  profiles.full_name,
  roles.role_key,
  roles.name as role_name,
  profiles.guide_id
from public.profiles
left join public.user_roles
  on user_roles.profile_id = profiles.id
left join public.roles
  on roles.id = user_roles.role_id
where lower(profiles.email) in (
  'super-admin@test.local',
  'admin@test.local',
  'internal@test.local',
  'guide@test.local'
)
order by profiles.email, roles.role_key;
