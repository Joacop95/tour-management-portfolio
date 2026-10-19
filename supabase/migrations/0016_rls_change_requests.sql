-- RLS Stage 2F: change_requests only.
--
-- This migration intentionally does not enable RLS or create policies on
-- audit_logs or any other table. It does not connect Guide Portal writes.

alter table public.change_requests enable row level security;

create policy "change_requests_select_internal_or_own_guide"
on public.change_requests
for select
to authenticated
using (
  is_archived = false
  and (
    public.has_permission('change_requests.view')
    or guide_id = public.current_user_guide_id()
  )
);

create policy "change_requests_insert_own_guide_pending"
on public.change_requests
for insert
to authenticated
with check (
  public.has_permission('guide_portal.request_group_change')
  and guide_id = public.current_user_guide_id()
  and request_status = 'pending'
  and (created_by_profile_id is null or created_by_profile_id = auth.uid())
  and resolved_at is null
  and resolved_by is null
  and reviewed_by_profile_id is null
  and reviewed_at is null
  and completed_at is null
  and cancelled_at is null
  and internal_notes is null
  and decision_reason is null
  and is_archived = false
  and archived_at is null
  and archived_by is null
  and archive_reason is null
);

create policy "change_requests_insert_internal"
on public.change_requests
for insert
to authenticated
with check (
  public.has_permission('change_requests.create_internal')
);

create policy "change_requests_update_review"
on public.change_requests
for update
to authenticated
using (
  public.has_permission('change_requests.review')
  and is_archived = false
)
with check (
  public.has_permission('change_requests.review')
  and is_archived = false
);

create policy "change_requests_update_archive"
on public.change_requests
for update
to authenticated
using (
  public.has_permission('change_requests.archive')
  and is_archived = false
)
with check (
  public.has_permission('change_requests.archive')
  and is_archived = true
  and archived_at is not null
);

comment on table public.change_requests is
  'RLS Stage 2F enabled. Internal users with change_requests.view can read non-archived requests. Internal users with change_requests.create_internal can create requests. Internal users with change_requests.review can update non-archived review state. Internal users with change_requests.archive can archive requests. Guide users can read their own non-archived requests and can insert only own pending requests through guide_portal.request_group_change. No DELETE policy is provided. Guide cancel-only update is deferred because row-level policies cannot safely restrict only cancellation columns.';
