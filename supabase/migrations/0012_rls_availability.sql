-- RLS Stage 2D: availability only.
-- This migration intentionally does not enable RLS or create policies on
-- change_requests, audit_logs, app_settings, notification_settings,
-- email_templates, or any other table.

alter table public.availability enable row level security;

create policy "availability_select_operational_or_own_guide"
on public.availability
for select
to authenticated
using (
  public.has_permission('availability.view')
  or public.has_permission('availability.create')
  or public.has_permission('availability.edit')
  or public.has_permission('availability.delete')
  or public.has_permission('assignments.view')
  or public.has_permission('assignments.assign_guide')
  or public.has_permission('assignments.change_guide')
  or public.has_permission('groups.view')
  or public.has_permission('groups.edit')
  or public.has_permission('groups.assign_guide')
  or guide_id = public.current_user_guide_id()
);

create policy "availability_insert_manual_records"
on public.availability
for insert
to authenticated
with check (
  public.has_permission('availability.create')
  and source <> 'assignment_generated'
  and status in ('available', 'not_available', 'pending_review')
  and assignment_id is null
);

create policy "availability_insert_assignment_generated_records"
on public.availability
for insert
to authenticated
with check (
  (
    public.has_permission('assignments.assign_guide')
    or public.has_permission('assignments.change_guide')
    or public.has_permission('groups.edit')
    or public.has_permission('groups.assign_guide')
  )
  and source = 'assignment_generated'
  and status = 'occupied_by_assignment'
  and assignment_id is not null
);

create policy "availability_update_manual_records"
on public.availability
for update
to authenticated
using (
  public.has_permission('availability.edit')
  and source <> 'assignment_generated'
  and status <> 'occupied_by_assignment'
  and assignment_id is null
  and is_archived = false
)
with check (
  source <> 'assignment_generated'
  and status in ('available', 'not_available', 'pending_review')
  and assignment_id is null
  and is_archived = false
);

create policy "availability_archive_manual_records"
on public.availability
for update
to authenticated
using (
  public.has_permission('availability.delete')
  and source <> 'assignment_generated'
  and status <> 'occupied_by_assignment'
  and assignment_id is null
  and is_archived = false
)
with check (
  source <> 'assignment_generated'
  and status in ('available', 'not_available', 'pending_review')
  and assignment_id is null
  and is_archived = true
);

create policy "availability_archive_assignment_generated_records"
on public.availability
for update
to authenticated
using (
  (
    public.has_permission('assignments.change_guide')
    or public.has_permission('assignments.assign_guide')
    or public.has_permission('groups.edit')
    or public.has_permission('groups.assign_guide')
  )
  and source = 'assignment_generated'
  and status = 'occupied_by_assignment'
  and assignment_id is not null
  and is_archived = false
)
with check (
  source = 'assignment_generated'
  and status = 'occupied_by_assignment'
  and assignment_id is not null
  and is_archived = true
);

comment on table public.availability is
  'RLS Stage 2D enabled. Policies separate manual availability records from assignment-generated occupied records. Manual create/edit/archive uses availability permissions. Assignment-generated create/archive uses assignment/group workflow permissions. No DELETE policy is provided because availability records are archived through update workflows.';
