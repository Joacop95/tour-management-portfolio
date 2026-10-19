-- RLS Stage 2E: Settings data tables only.
-- This migration intentionally does not enable RLS or create policies on
-- change_requests, audit_logs, guides, groups, assignments, availability,
-- circuits, circuit_aliases, guide_circuit_capabilities, or any other table.

alter table public.app_settings enable row level security;
alter table public.notification_settings enable row level security;
alter table public.email_templates enable row level security;

create policy "app_settings_select_manage_settings"
on public.app_settings
for select
to authenticated
using (public.has_permission('settings.manage_settings'));

create policy "app_settings_insert_manage_settings"
on public.app_settings
for insert
to authenticated
with check (public.has_permission('settings.manage_settings'));

create policy "app_settings_update_manage_settings"
on public.app_settings
for update
to authenticated
using (public.has_permission('settings.manage_settings'))
with check (public.has_permission('settings.manage_settings'));

create policy "notification_settings_select_manage_notifications"
on public.notification_settings
for select
to authenticated
using (public.has_permission('settings.manage_notification_settings'));

create policy "notification_settings_insert_manage_notifications"
on public.notification_settings
for insert
to authenticated
with check (public.has_permission('settings.manage_notification_settings'));

create policy "notification_settings_update_manage_notifications"
on public.notification_settings
for update
to authenticated
using (public.has_permission('settings.manage_notification_settings'))
with check (public.has_permission('settings.manage_notification_settings'));

create policy "email_templates_select_manage_templates"
on public.email_templates
for select
to authenticated
using (public.has_permission('settings.manage_email_templates'));

create policy "email_templates_insert_manage_templates"
on public.email_templates
for insert
to authenticated
with check (public.has_permission('settings.manage_email_templates'));

create policy "email_templates_update_manage_templates"
on public.email_templates
for update
to authenticated
using (public.has_permission('settings.manage_email_templates'))
with check (public.has_permission('settings.manage_email_templates'));

comment on table public.app_settings is
  'RLS Stage 2E enabled. SELECT/INSERT/UPDATE require settings.manage_settings. No DELETE policy is provided because current Settings data workflows do not hard delete settings rows.';

comment on table public.notification_settings is
  'RLS Stage 2E enabled. SELECT/INSERT/UPDATE require settings.manage_notification_settings. No DELETE policy is provided; archive/deactivation should use update workflows if connected later.';

comment on table public.email_templates is
  'RLS Stage 2E enabled. SELECT/INSERT/UPDATE require settings.manage_email_templates. No DELETE policy is provided; archive/deactivation should use update workflows if connected later.';
