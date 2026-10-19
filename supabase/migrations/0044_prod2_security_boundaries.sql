-- PROD-2: close confirmed browser table and Guide Portal boundaries.

-- audit_logs has no browser workflow. Its original default grants allowed anon
-- reads and writes, including forged audit entries.
alter table public.audit_logs enable row level security;
revoke all on table public.audit_logs from public, anon, authenticated;

-- Role/permission definitions and user-role bindings are not browser-editable.
-- The protected role matrix is changed only through replace_role_permissions.
revoke insert, update, delete on table public.profiles from public, anon, authenticated;
revoke insert, update, delete on table public.roles from public, anon, authenticated;
revoke insert, update, delete on table public.permissions from public, anon, authenticated;
revoke insert, update, delete on table public.user_roles from public, anon, authenticated;

-- The application archives operational records and never issues table DELETE.
-- Physical deletion would discard history and linked authorizations.
revoke delete on table public.groups, public.guides, public.circuits,
  public.circuit_aliases, public.guide_circuit_capabilities
  from public, anon, authenticated;
drop policy "groups_delete_groups_edit" on public.groups;
drop policy "guides_delete_guides_edit" on public.guides;
drop policy "circuits_delete_settings_admin" on public.circuits;
drop policy "circuit_aliases_delete_settings_admin" on public.circuit_aliases;
drop policy "guide_circuit_capabilities_delete_guides_edit" on public.guide_circuit_capabilities;

-- These older SECURITY DEFINER bodies already schema-qualify object references.
alter function public.current_user_role_keys() set search_path = '';
alter function public.current_user_permission_keys() set search_path = '';
alter function public.has_permission(text) set search_path = '';
alter function public.current_user_guide_id() set search_path = '';
alter function public.claim_authorized_guide_profile() set search_path = '';
alter function public.claim_authorized_internal_profile() set search_path = '';
alter function public.hook_before_user_created_authorized_signup(jsonb) set search_path = '';
alter function public.confirm_own_guide_assignment(uuid) set search_path = '';
alter function public.validate_internal_authorized_user_role() set search_path = '';

revoke execute on function public.current_user_role_keys() from public, anon;
revoke execute on function public.current_user_permission_keys() from public, anon;
revoke execute on function public.has_permission(text) from public, anon;
revoke execute on function public.current_user_guide_id() from public, anon;

-- Guide Portal views explicitly filter to auth.uid()'s linked guide and return
-- column-safe projections. Base-table own-row SELECT exposed internal columns.
alter view public.guide_portal_guides set (security_invoker = false);
alter view public.guide_portal_groups set (security_invoker = false);
alter view public.guide_portal_assignments set (security_invoker = false);
alter view public.guide_portal_availability set (security_invoker = false);
alter view public.guide_portal_change_requests set (security_invoker = false);

-- Existing malformed request references must not reveal an unrelated group's
-- details merely because the request itself belongs to this guide.
create or replace view public.guide_portal_change_requests
with (security_invoker = false)
as
select
  cr.id as change_request_id, cr.guide_id, cr.group_id,
  cr.assignment_id, cr.availability_id, cr.request_type,
  cr.request_status, cr.requested_at,
  coalesce(cr.guide_message, cr.reason, cr.notes, '') as guide_message,
  cr.decision_reason, cr.reviewed_at, cr.completed_at, cr.cancelled_at,
  g.group_code, g.circuit_id, c.name as circuit_name,
  c.code as circuit_code, g.start_date as group_start_date,
  g.end_date as group_end_date
from public.change_requests as cr
left join public.groups as g on g.id = cr.group_id
  and not g.is_archived
  and exists (
    select 1 from public.assignments as own_assignment
    where own_assignment.group_id = g.id
      and own_assignment.guide_id = public.current_user_guide_id()
  )
left join public.circuits as c on c.id = g.circuit_id
  and not c.is_archived
where not cr.is_archived and cr.archived_at is null
  and cr.guide_id = public.current_user_guide_id();

alter policy "guides_select_operational_or_own_guide" on public.guides
  using (
    public.has_permission('guides.view')
    or public.has_permission('groups.view')
    or public.has_permission('assignments.view')
  );
alter policy "guide_circuit_capabilities_select_operational_or_own" on public.guide_circuit_capabilities
  using (
    public.has_permission('guides.view')
    or public.has_permission('assignments.view')
  );
alter policy "guide_authorized_emails_select_internal_or_own" on public.guide_authorized_emails
  using (public.has_permission('guides.view'));
alter policy "groups_select_operational_or_own_guide" on public.groups
  using (
    public.has_permission('groups.view')
    or public.has_permission('assignments.view')
    or public.has_permission('groups.edit')
    or public.has_permission('groups.assign_guide')
    or public.has_permission('groups.confirm_guide')
  );
-- Group-row edits require groups.edit. Assignment/confirmation-only actors use
-- the privileged RPCs, which derive and update the summary themselves.
alter policy "groups_update_groups_edit" on public.groups
  using (public.has_permission('groups.edit'))
  with check (public.has_permission('groups.edit'));
alter policy "assignments_select_operational_or_own_guide" on public.assignments
  using (
    public.has_permission('assignments.view')
    or public.has_permission('groups.view')
    or public.has_permission('groups.edit')
    or public.has_permission('groups.assign_guide')
    or public.has_permission('groups.confirm_guide')
    or public.has_permission('assignments.assign_guide')
    or public.has_permission('assignments.change_guide')
    or public.has_permission('assignments.confirm_guide')
  );
alter policy "availability_select_operational_or_own_guide" on public.availability
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
  );
alter policy "change_requests_select_internal_or_own_guide" on public.change_requests
  using (is_archived = false and public.has_permission('change_requests.view'));

-- Assignment actions use transactional RPCs. The only remaining direct UPDATE
-- caller is the legacy Groups editor, which requires groups.edit.
alter policy "assignments_insert_assignment_or_group_workflow" on public.assignments
  with check (
    public.has_permission('groups.create')
    or public.has_permission('groups.edit')
  );
alter policy "assignments_update_assignment_or_group_workflow" on public.assignments
  using (public.has_permission('groups.edit'))
  with check (public.has_permission('groups.edit'));

-- Occupied periods are written by assignment/status definer RPCs, never by
-- the browser availability form. Direct writes could forge occupancy.
drop policy "availability_insert_assignment_generated_records" on public.availability;
drop policy "availability_archive_assignment_generated_records" on public.availability;

-- A guide's direct INSERT previously accepted unrelated group/assignment/
-- availability UUIDs. Keep the existing workflow, but validate references
-- against the caller's linked guide under a narrow definer helper.
create function public.guide_change_request_references_are_owned(
  p_group_id uuid,
  p_assignment_id uuid,
  p_availability_id uuid
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_guide_id uuid := public.current_user_guide_id();
begin
  if auth.uid() is null or v_guide_id is null then
    return false;
  end if;
  if p_group_id is not null and not exists (
    select 1 from public.assignments as a
    where a.group_id = p_group_id and a.guide_id = v_guide_id
      and a.is_current and not a.is_archived
  ) then
    return false;
  end if;
  if p_assignment_id is not null and not exists (
    select 1 from public.assignments as a
    where a.id = p_assignment_id and a.guide_id = v_guide_id
      and a.is_current and not a.is_archived
      and (p_group_id is null or a.group_id = p_group_id)
  ) then
    return false;
  end if;
  if p_availability_id is not null and not exists (
    select 1 from public.availability as av
    where av.id = p_availability_id and av.guide_id = v_guide_id
      and not av.is_archived
  ) then
    return false;
  end if;
  return true;
end;
$$;
revoke all on function public.guide_change_request_references_are_owned(uuid, uuid, uuid) from public, anon;
grant execute on function public.guide_change_request_references_are_owned(uuid, uuid, uuid) to authenticated;

alter policy "change_requests_insert_own_guide_pending" on public.change_requests
  with check (
    public.has_permission('guide_portal.request_group_change')
    and guide_id = public.current_user_guide_id()
    and public.guide_change_request_references_are_owned(group_id, assignment_id, availability_id)
    and request_status = 'pending'
    and (created_by_profile_id is null or created_by_profile_id = auth.uid())
    and resolved_at is null and resolved_by is null
    and reviewed_by_profile_id is null and reviewed_at is null
    and completed_at is null and cancelled_at is null
    and internal_notes is null and decision_reason is null
    and is_archived = false and archived_at is null
    and archived_by is null and archive_reason is null
  );

-- Existing internal review uses a direct UPDATE. Bind audit identities to the
-- caller and enforce the same status transitions as the current review UI.
create function public.guard_browser_change_request_write()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
begin
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;
  if v_actor is null then
    raise exception using errcode = '42501', message = 'Sign in before changing a request.';
  end if;

  if tg_op = 'INSERT' then
    new.created_by_profile_id := v_actor;
    new.updated_by := v_actor;
    new.requested_at := v_now;
    return new;
  end if;

  if (to_jsonb(new) - array[
    'request_status', 'internal_notes', 'decision_reason',
    'reviewed_by_profile_id', 'reviewed_at', 'resolved_by', 'resolved_at',
    'completed_at', 'is_archived', 'archived_at', 'archived_by',
    'archive_reason', 'updated_by', 'updated_at'
  ]::text[]) is distinct from (to_jsonb(old) - array[
    'request_status', 'internal_notes', 'decision_reason',
    'reviewed_by_profile_id', 'reviewed_at', 'resolved_by', 'resolved_at',
    'completed_at', 'is_archived', 'archived_at', 'archived_by',
    'archive_reason', 'updated_by', 'updated_at'
  ]::text[]) then
    raise exception using errcode = '42501', message = 'Request identity and references cannot be changed.';
  end if;

  if new.is_archived and not old.is_archived then
    if not public.has_permission('change_requests.archive')
      or new.request_status is distinct from old.request_status then
      raise exception using errcode = '42501', message = 'This request cannot be archived.';
    end if;
    new.archived_at := v_now;
    new.archived_by := v_actor;
    new.reviewed_by_profile_id := old.reviewed_by_profile_id;
    new.reviewed_at := old.reviewed_at;
    new.resolved_by := old.resolved_by;
    new.resolved_at := old.resolved_at;
    new.completed_at := old.completed_at;
  else
    if new.is_archived is distinct from old.is_archived
      or not public.has_permission('change_requests.review') then
      raise exception using errcode = '42501', message = 'This request cannot be reviewed.';
    end if;
    if new.request_status is distinct from old.request_status and not (
      (old.request_status = 'pending' and new.request_status in ('in_progress', 'approved', 'rejected', 'completed'))
      or (old.request_status = 'in_progress' and new.request_status in ('approved', 'rejected', 'completed'))
      or (old.request_status = 'approved' and new.request_status = 'completed')
    ) then
      raise exception using errcode = '42501', message = 'This request status transition is not allowed.';
    end if;
    new.reviewed_by_profile_id := v_actor;
    new.reviewed_at := v_now;
    if new.request_status in ('approved', 'rejected', 'completed') then
      new.resolved_by := v_actor;
      new.resolved_at := v_now;
    else
      new.resolved_by := old.resolved_by;
      new.resolved_at := old.resolved_at;
    end if;
    new.completed_at := case when new.request_status = 'completed' then v_now else old.completed_at end;
    new.archived_at := old.archived_at;
    new.archived_by := old.archived_by;
    new.archive_reason := old.archive_reason;
  end if;
  new.updated_by := v_actor;
  new.updated_at := v_now;
  return new;
end;
$$;
revoke all on function public.guard_browser_change_request_write() from public, anon, authenticated;
create trigger guard_browser_change_request_write
before insert or update on public.change_requests
for each row execute function public.guard_browser_change_request_write();
