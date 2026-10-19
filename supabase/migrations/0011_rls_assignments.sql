-- RLS Stage 2C: assignments only.
-- This migration intentionally does not enable RLS or create policies on
-- availability or any other operational table.

alter table public.assignments enable row level security;

create policy "assignments_select_operational_or_own_guide"
on public.assignments
for select
to authenticated
using (
  public.has_permission('assignments.view')
  or public.has_permission('groups.view')
  or public.has_permission('groups.edit')
  or public.has_permission('groups.assign_guide')
  or public.has_permission('groups.confirm_guide')
  or public.has_permission('assignments.assign_guide')
  or public.has_permission('assignments.change_guide')
  or public.has_permission('assignments.confirm_guide')
  or guide_id = public.current_user_guide_id()
);

create policy "assignments_insert_assignment_or_group_workflow"
on public.assignments
for insert
to authenticated
with check (
  public.has_permission('assignments.assign_guide')
  or public.has_permission('assignments.change_guide')
  or public.has_permission('groups.create')
  or public.has_permission('groups.edit')
  or public.has_permission('groups.assign_guide')
);

create policy "assignments_update_assignment_or_group_workflow"
on public.assignments
for update
to authenticated
using (
  public.has_permission('assignments.change_guide')
  or public.has_permission('assignments.confirm_guide')
  or public.has_permission('groups.edit')
  or public.has_permission('groups.assign_guide')
  or public.has_permission('groups.confirm_guide')
)
with check (
  public.has_permission('assignments.change_guide')
  or public.has_permission('assignments.confirm_guide')
  or public.has_permission('groups.edit')
  or public.has_permission('groups.assign_guide')
  or public.has_permission('groups.confirm_guide')
);

comment on table public.assignments is
  'RLS Stage 2C enabled. Policies support operational assignment reads, group create/edit assignment dependencies, assignment change/confirm workflows, and guide-scoped reads. No DELETE policy is provided because assignment history is preserved through update/replacement workflows. Availability remains pending RLS.';
