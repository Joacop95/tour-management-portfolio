-- RLS Stage 2B: groups table only.
--
-- Scope:
-- - groups
--
-- This migration intentionally does not enable RLS or create policies on
-- assignments, availability, change_requests, audit_logs, app_settings,
-- notification_settings, email_templates, or any other table.

alter table public.groups enable row level security;

create policy "groups_select_operational_or_own_guide"
on public.groups
for select
to authenticated
using (
  public.has_permission('groups.view')
  or public.has_permission('assignments.view')
  or public.has_permission('groups.edit')
  or public.has_permission('groups.assign_guide')
  or public.has_permission('groups.confirm_guide')
  or exists (
    select 1
    from public.assignments
    where assignments.group_id = groups.id
      and assignments.guide_id = public.current_user_guide_id()
      and assignments.is_current = true
      and assignments.is_archived = false
  )
);

create policy "groups_insert_groups_create"
on public.groups
for insert
to authenticated
with check (
  public.has_permission('groups.create')
);

create policy "groups_update_groups_edit"
on public.groups
for update
to authenticated
using (
  public.has_permission('groups.edit')
  or public.has_permission('groups.assign_guide')
  or public.has_permission('groups.confirm_guide')
  or public.has_permission('assignments.assign_guide')
  or public.has_permission('assignments.change_guide')
  or public.has_permission('assignments.confirm_guide')
)
with check (
  public.has_permission('groups.edit')
  or public.has_permission('groups.assign_guide')
  or public.has_permission('groups.confirm_guide')
  or public.has_permission('assignments.assign_guide')
  or public.has_permission('assignments.change_guide')
  or public.has_permission('assignments.confirm_guide')
);

create policy "groups_delete_groups_edit"
on public.groups
for delete
to authenticated
using (
  public.has_permission('groups.edit')
);

comment on table public.groups is
  'RLS Stage 2B enabled. Internal users can read/manage groups by permission; assignment users can update group assignment summary fields through current client workflows; guide users can read groups currently assigned to their linked guide. Guide-scoped reads depend on current assignment rows and must be retested when assignments RLS is added.';
