-- ONE-TIME DEMO OPERATIONAL DATA RESET
--
-- This is intentionally not a migration. Run only after verifying the target
-- Supabase project and taking a database restore point. The script defaults to
-- ROLLBACK so an accidental execution cannot persist the reset.
--
-- Preserved:
--   auth.users, profiles, internal_authorized_users, internal user_roles,
--   roles, permissions, role_permissions, translations, audit_logs,
--   app_settings, notification_settings, email_templates, and migrations.
--
-- Cleared:
--   assignment_notification_outbox, change_requests, availability,
--   guide_availability_submissions, assignments, groups,
--   guide_circuit_capabilities, guide_authorized_emails, Guides' user_roles,
--   profiles.guide_id links, guides, circuit_aliases,
--   group_code_circuit_mappings, and circuits.

begin;

create temporary table demo_reset_preserved_counts (
  metric text primary key,
  row_count bigint not null
) on commit drop;

insert into demo_reset_preserved_counts (metric, row_count)
values
  ('auth.users', (select count(*) from auth.users)),
  ('profiles', (select count(*) from public.profiles)),
  ('internal_authorized_users', (select count(*) from public.internal_authorized_users)),
  ('internal_user_roles', (
    select count(*)
    from public.user_roles as user_role
    join public.roles as role on role.id = user_role.role_id
    where role.role_key in ('super-admin', 'admin-administrativo', 'consulta-interna')
  )),
  ('roles', (select count(*) from public.roles)),
  ('permissions', (select count(*) from public.permissions)),
  ('role_permissions', (select count(*) from public.role_permissions)),
  ('translation_entries', (select count(*) from public.translation_entries)),
  ('translation_values', (select count(*) from public.translation_values)),
  ('audit_logs', (select count(*) from public.audit_logs)),
  ('app_settings', (select count(*) from public.app_settings)),
  ('notification_settings', (select count(*) from public.notification_settings)),
  ('email_templates', (select count(*) from public.email_templates)),
  ('migration_versions', (select count(*) from supabase_migrations.schema_migrations));

-- BEFORE counts
select stage, relation_name, row_count
from (
  select 'BEFORE'::text as stage, 'assignment_notification_outbox'::text as relation_name,
    (select count(*) from public.assignment_notification_outbox) as row_count
  union all select 'BEFORE', 'change_requests', (select count(*) from public.change_requests)
  union all select 'BEFORE', 'availability', (select count(*) from public.availability)
  union all select 'BEFORE', 'guide_availability_submissions', (select count(*) from public.guide_availability_submissions)
  union all select 'BEFORE', 'assignments', (select count(*) from public.assignments)
  union all select 'BEFORE', 'groups', (select count(*) from public.groups)
  union all select 'BEFORE', 'guide_circuit_capabilities', (select count(*) from public.guide_circuit_capabilities)
  union all select 'BEFORE', 'guide_authorized_emails', (select count(*) from public.guide_authorized_emails)
  union all select 'BEFORE', 'guide_role_bindings', (
    select count(*) from public.user_roles as user_role
    join public.roles as role on role.id = user_role.role_id
    where role.role_key = 'guide'
  )
  union all select 'BEFORE', 'profile_guide_links', (select count(*) from public.profiles where guide_id is not null)
  union all select 'BEFORE', 'guides', (select count(*) from public.guides)
  union all select 'BEFORE', 'circuit_aliases', (select count(*) from public.circuit_aliases)
  union all select 'BEFORE', 'group_code_circuit_mappings', (select count(*) from public.group_code_circuit_mappings)
  union all select 'BEFORE', 'circuits', (select count(*) from public.circuits)
) as counts
order by relation_name;

-- Child-to-parent deletion order follows the current public foreign keys.
delete from public.assignment_notification_outbox;
delete from public.change_requests;
delete from public.availability;
delete from public.guide_availability_submissions;
delete from public.assignments;
delete from public.groups;
delete from public.guide_circuit_capabilities;
delete from public.guide_authorized_emails;

-- Keep every Auth user and profile. Remove only the Guide authorization domain.
delete from public.user_roles as user_role
using public.roles as role
where role.id = user_role.role_id
  and role.role_key = 'guide';

update public.profiles
set guide_id = null,
    updated_at = clock_timestamp()
where guide_id is not null;

delete from public.guides;
delete from public.circuit_aliases;
delete from public.group_code_circuit_mappings;
delete from public.circuits;

-- AFTER counts
select stage, relation_name, row_count
from (
  select 'AFTER'::text as stage, 'assignment_notification_outbox'::text as relation_name,
    (select count(*) from public.assignment_notification_outbox) as row_count
  union all select 'AFTER', 'change_requests', (select count(*) from public.change_requests)
  union all select 'AFTER', 'availability', (select count(*) from public.availability)
  union all select 'AFTER', 'guide_availability_submissions', (select count(*) from public.guide_availability_submissions)
  union all select 'AFTER', 'assignments', (select count(*) from public.assignments)
  union all select 'AFTER', 'groups', (select count(*) from public.groups)
  union all select 'AFTER', 'guide_circuit_capabilities', (select count(*) from public.guide_circuit_capabilities)
  union all select 'AFTER', 'guide_authorized_emails', (select count(*) from public.guide_authorized_emails)
  union all select 'AFTER', 'guide_role_bindings', (
    select count(*) from public.user_roles as user_role
    join public.roles as role on role.id = user_role.role_id
    where role.role_key = 'guide'
  )
  union all select 'AFTER', 'profile_guide_links', (select count(*) from public.profiles where guide_id is not null)
  union all select 'AFTER', 'guides', (select count(*) from public.guides)
  union all select 'AFTER', 'circuit_aliases', (select count(*) from public.circuit_aliases)
  union all select 'AFTER', 'group_code_circuit_mappings', (select count(*) from public.group_code_circuit_mappings)
  union all select 'AFTER', 'circuits', (select count(*) from public.circuits)
) as counts
order by relation_name;

-- Fail closed if any operational rows or Guide authorization links remain.
do $$
declare
  remaining_rows bigint;
begin
  select
    (select count(*) from public.assignment_notification_outbox)
    + (select count(*) from public.change_requests)
    + (select count(*) from public.availability)
    + (select count(*) from public.guide_availability_submissions)
    + (select count(*) from public.assignments)
    + (select count(*) from public.groups)
    + (select count(*) from public.guide_circuit_capabilities)
    + (select count(*) from public.guide_authorized_emails)
    + (select count(*) from public.guides)
    + (select count(*) from public.circuit_aliases)
    + (select count(*) from public.group_code_circuit_mappings)
    + (select count(*) from public.circuits)
    + (select count(*) from public.profiles where guide_id is not null)
    + (
      select count(*)
      from public.user_roles as user_role
      join public.roles as role on role.id = user_role.role_id
      where role.role_key = 'guide'
    )
  into remaining_rows;

  if remaining_rows <> 0 then
    raise exception 'Demo reset verification failed: % operational rows remain.', remaining_rows;
  end if;
end;
$$;

-- Fail closed if protected Auth/internal/configuration data changed.
do $$
declare
  mismatch_count integer;
begin
  with current_counts(metric, row_count) as (
    values
      ('auth.users', (select count(*) from auth.users)),
      ('profiles', (select count(*) from public.profiles)),
      ('internal_authorized_users', (select count(*) from public.internal_authorized_users)),
      ('internal_user_roles', (
        select count(*)
        from public.user_roles as user_role
        join public.roles as role on role.id = user_role.role_id
        where role.role_key in ('super-admin', 'admin-administrativo', 'consulta-interna')
      )),
      ('roles', (select count(*) from public.roles)),
      ('permissions', (select count(*) from public.permissions)),
      ('role_permissions', (select count(*) from public.role_permissions)),
      ('translation_entries', (select count(*) from public.translation_entries)),
      ('translation_values', (select count(*) from public.translation_values)),
      ('audit_logs', (select count(*) from public.audit_logs)),
      ('app_settings', (select count(*) from public.app_settings)),
      ('notification_settings', (select count(*) from public.notification_settings)),
      ('email_templates', (select count(*) from public.email_templates)),
      ('migration_versions', (select count(*) from supabase_migrations.schema_migrations))
  )
  select count(*)
  into mismatch_count
  from demo_reset_preserved_counts as before_count
  join current_counts as after_count using (metric)
  where before_count.row_count <> after_count.row_count;

  if mismatch_count <> 0 then
    raise exception 'Demo reset verification failed: protected data counts changed.';
  end if;
end;
$$;

-- Protected-data verification output.
select
  before_count.metric,
  before_count.row_count as before_count,
  after_count.row_count as after_count,
  before_count.row_count = after_count.row_count as preserved
from demo_reset_preserved_counts as before_count
join lateral (
  select case before_count.metric
    when 'auth.users' then (select count(*) from auth.users)
    when 'profiles' then (select count(*) from public.profiles)
    when 'internal_authorized_users' then (select count(*) from public.internal_authorized_users)
    when 'internal_user_roles' then (
      select count(*)
      from public.user_roles as user_role
      join public.roles as role on role.id = user_role.role_id
      where role.role_key in ('super-admin', 'admin-administrativo', 'consulta-interna')
    )
    when 'roles' then (select count(*) from public.roles)
    when 'permissions' then (select count(*) from public.permissions)
    when 'role_permissions' then (select count(*) from public.role_permissions)
    when 'translation_entries' then (select count(*) from public.translation_entries)
    when 'translation_values' then (select count(*) from public.translation_values)
    when 'audit_logs' then (select count(*) from public.audit_logs)
    when 'app_settings' then (select count(*) from public.app_settings)
    when 'notification_settings' then (select count(*) from public.notification_settings)
    when 'email_templates' then (select count(*) from public.email_templates)
    when 'migration_versions' then (select count(*) from supabase_migrations.schema_migrations)
  end as row_count
) as after_count on true
order by before_count.metric;

-- SAFETY DEFAULT: all changes above are rolled back.
-- To perform the reviewed reset, replace ROLLBACK with COMMIT immediately
-- before execution. Never run this script against an unverified project.
rollback;
-- commit;
