-- PROD-2B: all Groups writes that can affect assignment state run under
-- authenticated, permission-checked transactional functions.

create function public.create_internal_group(
  p_group_code text,
  p_circuit_id uuid,
  p_start_date date,
  p_end_date date,
  p_language public.supported_language,
  p_estimated_passengers integer,
  p_internal_notes text,
  p_guide_id uuid,
  p_confirm_guide boolean
)
returns table (success boolean, code text, message text, group_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_group_id uuid;
  v_assignment record;
  v_confirmation record;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or not public.has_permission('groups.create') then
    return query select false, 'not_authorized', 'You do not have permission to create groups.', null::uuid;
    return;
  end if;
  if nullif(btrim(p_group_code), '') is null or p_circuit_id is null
    or p_start_date is null or p_end_date is null or p_end_date < p_start_date
    or (p_estimated_passengers is not null and p_estimated_passengers < 0)
    or (p_confirm_guide and p_guide_id is null) then
    return query select false, 'invalid_group', 'Check the group details and try again.', null::uuid;
    return;
  end if;

  insert into public.groups (
    group_code, circuit_id, start_date, end_date, group_status,
    assignment_status, confirmation_status, language, estimated_passengers,
    internal_notes, created_at, updated_at, updated_by
  ) values (
    btrim(p_group_code), p_circuit_id, p_start_date, p_end_date, 'active',
    'without_guide', 'not_required', p_language, p_estimated_passengers,
    nullif(btrim(p_internal_notes), ''), v_now, v_now, v_actor
  ) returning id into v_group_id;

  if p_guide_id is null then
    insert into public.assignments (
      group_id, guide_id, status, confirmation_status, is_current,
      assigned_at, assigned_by, created_at, updated_at, updated_by
    ) values (
      v_group_id, null, 'without_guide', 'not_required', true,
      v_now, v_actor, v_now, v_now, v_actor
    );
  else
    select * into v_assignment from public.set_internal_group_guide(v_group_id, p_guide_id, null);
    if not v_assignment.success then
      raise exception using errcode = '42501', message = 'Group assignment could not be completed.';
    end if;
    if p_confirm_guide then
      select * into v_confirmation from public.confirm_internal_group_guide(v_group_id, v_assignment.assignment_id);
      if not v_confirmation.success then
        raise exception using errcode = '42501', message = 'Group confirmation could not be completed.';
      end if;
    end if;
  end if;

  return query select true, 'created', 'Group created.', v_group_id;
end;
$$;

create function public.update_internal_group(
  p_group_id uuid,
  p_expected_updated_at timestamptz,
  p_expected_assignment_id uuid,
  p_group_code text,
  p_circuit_id uuid,
  p_start_date date,
  p_end_date date,
  p_language public.supported_language,
  p_estimated_passengers integer,
  p_internal_notes text,
  p_guide_id uuid,
  p_confirmation_status public.confirmation_status
)
returns table (success boolean, code text, message text)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_group public.groups%rowtype;
  v_current public.assignments%rowtype;
  v_assignment record;
  v_confirmation record;
  v_effective_assignment_id uuid;
  v_effective_confirmation public.confirmation_status;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or not public.has_permission('groups.edit') then
    return query select false, 'not_authorized', 'You do not have permission to edit groups.';
    return;
  end if;
  if nullif(btrim(p_group_code), '') is null or p_circuit_id is null
    or p_start_date is null or p_end_date is null or p_end_date < p_start_date
    or (p_estimated_passengers is not null and p_estimated_passengers < 0)
    or p_confirmation_status is null then
    return query select false, 'invalid_group', 'Check the group details and try again.';
    return;
  end if;

  select g.* into v_group from public.groups as g
  where g.id = p_group_id and not g.is_archived for update;
  if not found then
    return query select false, 'group_not_found', 'This group is no longer available.';
    return;
  end if;
  select a.* into v_current from public.assignments as a
  where a.group_id = p_group_id and a.is_current and not a.is_archived for update;
  if v_group.updated_at is distinct from p_expected_updated_at
    or v_current.id is distinct from p_expected_assignment_id then
    return query select false, 'state_changed', 'This group or assignment changed. Refresh and try again.';
    return;
  end if;
  if v_current.guide_id is not null and (
    v_group.start_date is distinct from p_start_date
    or v_group.end_date is distinct from p_end_date
    or v_group.circuit_id is distinct from p_circuit_id
  ) then
    return query select false, 'assigned_schedule_edit_unsupported',
      'Remove the guide before changing this group''s dates or circuit.';
    return;
  end if;
  if (p_guide_id is null and p_confirmation_status <> 'not_required')
    or (p_guide_id is not null and p_confirmation_status = 'not_required') then
    return query select false, 'invalid_confirmation', 'Check the guide confirmation status.';
    return;
  end if;
  if p_guide_id is not distinct from v_current.guide_id
    and v_current.confirmation_status = 'confirmed'
    and p_confirmation_status <> 'confirmed' then
    return query select false, 'cannot_unconfirm', 'A confirmed guide cannot be set back to pending here.';
    return;
  end if;

  update public.groups as g set
    group_code = btrim(p_group_code), circuit_id = p_circuit_id,
    start_date = p_start_date, end_date = p_end_date,
    language = p_language, estimated_passengers = p_estimated_passengers,
    internal_notes = nullif(btrim(p_internal_notes), ''),
    updated_at = v_now, updated_by = v_actor
  where g.id = p_group_id and g.updated_at = p_expected_updated_at;
  if not found then
    raise exception using errcode = '40001', message = 'Group changed concurrently.';
  end if;

  v_effective_assignment_id := v_current.id;
  v_effective_confirmation := v_current.confirmation_status;
  if p_guide_id is distinct from v_current.guide_id then
    select * into v_assignment from public.set_internal_group_guide(
      p_group_id, p_guide_id, v_current.id
    );
    if not v_assignment.success then
      raise exception using errcode = '42501', message = 'Group assignment could not be completed.';
    end if;
    v_effective_assignment_id := v_assignment.assignment_id;
    v_effective_confirmation := case when p_guide_id is null
      then 'not_required'::public.confirmation_status
      else 'pending_confirmation'::public.confirmation_status end;
  end if;

  if p_guide_id is not null and p_confirmation_status = 'confirmed'
    and v_effective_confirmation = 'pending_confirmation' then
    select * into v_confirmation from public.confirm_internal_group_guide(
      p_group_id, v_effective_assignment_id
    );
    if not v_confirmation.success then
      raise exception using errcode = '42501', message = 'Group confirmation could not be completed.';
    end if;
  end if;

  -- Nested assignment RPCs use transaction-start now(); keep the group version
  -- strictly newer than the input version for subsequent stale-edit checks.
  update public.groups as g set updated_at = clock_timestamp(), updated_by = v_actor
  where g.id = p_group_id;
  return query select true, 'saved', 'Group updated.';
end;
$$;

create function public.archive_internal_change_request(p_request_id uuid)
returns table (success boolean, code text, message text)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_request public.change_requests%rowtype;
  v_now timestamptz := clock_timestamp();
begin
  if v_actor is null or not public.has_permission('change_requests.archive') then
    return query select false, 'not_authorized', 'You do not have permission to archive change requests.';
    return;
  end if;
  select cr.* into v_request from public.change_requests as cr
  where cr.id = p_request_id for update;
  if not found or v_request.is_archived then
    return query select false, 'request_not_active', 'This change request is no longer active.';
    return;
  end if;
  update public.change_requests as cr set
    is_archived = true, archived_at = v_now, archived_by = v_actor,
    updated_at = v_now, updated_by = v_actor
  where cr.id = p_request_id and not cr.is_archived;
  if not found then
    raise exception using errcode = '40001', message = 'Change request changed concurrently.';
  end if;
  return query select true, 'archived', 'Change request archived.';
end;
$$;

revoke all on function public.create_internal_group(text, uuid, date, date, public.supported_language, integer, text, uuid, boolean) from public, anon;
grant execute on function public.create_internal_group(text, uuid, date, date, public.supported_language, integer, text, uuid, boolean) to authenticated;
revoke all on function public.update_internal_group(uuid, timestamptz, uuid, text, uuid, date, date, public.supported_language, integer, text, uuid, public.confirmation_status) from public, anon;
grant execute on function public.update_internal_group(uuid, timestamptz, uuid, text, uuid, date, date, public.supported_language, integer, text, uuid, public.confirmation_status) to authenticated;
revoke all on function public.archive_internal_change_request(uuid) from public, anon;
grant execute on function public.archive_internal_change_request(uuid) to authenticated;

-- No browser workflow needs direct assignment or group table mutation now.
revoke insert, update on public.assignments from public, anon, authenticated;
revoke insert, update on public.groups from public, anon, authenticated;
drop policy "assignments_insert_assignment_or_group_workflow" on public.assignments;
drop policy "assignments_update_assignment_or_group_workflow" on public.assignments;
drop policy "groups_insert_groups_create" on public.groups;
drop policy "groups_update_groups_edit" on public.groups;
drop policy "change_requests_update_archive" on public.change_requests;

insert into public.translation_entries (key, context, description, english_source)
values (
  'groups.error.assigned_schedule_edit', 'Groups',
  'Assigned group schedule or circuit cannot be edited until the guide is removed.',
  'Remove the guide before changing this group''s dates or circuit.'
)
on conflict (key) do nothing;

-- The Groups editor can confirm a new guide in the same transaction. The
-- deferred trigger should enqueue a confirmation request only if the new
-- assignment still awaits confirmation when that transaction completes.
create or replace function public.capture_internal_assignment_notifications()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_previous public.assignments%rowtype;
  v_pending boolean;
begin
  if new.change_reason not in (
    'Guide assigned from internal assignment workflow',
    'Guide changed from internal assignment workflow',
    'Guide removed from internal assignment workflow'
  ) then
    return null;
  end if;

  select a.* into v_previous from public.assignments as a
  where a.replaced_by_assignment_id = new.id
  order by a.created_at desc limit 1;
  select a.is_current and not a.is_archived and a.confirmation_status = 'pending_confirmation'
    into v_pending from public.assignments as a where a.id = new.id;

  if new.change_reason = 'Guide assigned from internal assignment workflow'
    and new.guide_id is not null then
    perform public.enqueue_assignment_notification_intent(
      'assignment_created', new.group_id, new.id, new.guide_id,
      'assigned_groups_email', 'assignment_created:' || new.id::text,
      false, new.assigned_by
    );
    if coalesce(v_pending, false) then
      perform public.enqueue_assignment_notification_intent(
        'confirmation_request', new.group_id, new.id, new.guide_id,
        'guide_confirmation_reminder', 'confirmation_request:' || new.id::text || ':initial',
        false, new.assigned_by
      );
    end if;
  elsif new.change_reason = 'Guide changed from internal assignment workflow'
    and new.guide_id is not null then
    if v_previous.guide_id is not null then
      perform public.enqueue_assignment_notification_intent(
        'assignment_changed_previous_guide', new.group_id, v_previous.id,
        v_previous.guide_id, 'assignment_changed',
        'assignment_changed_previous_guide:' || new.id::text,
        false, new.assigned_by
      );
    end if;
    perform public.enqueue_assignment_notification_intent(
      'assignment_changed_new_guide', new.group_id, new.id, new.guide_id,
      'assigned_groups_email', 'assignment_changed_new_guide:' || new.id::text,
      false, new.assigned_by
    );
    if coalesce(v_pending, false) then
      perform public.enqueue_assignment_notification_intent(
        'confirmation_request', new.group_id, new.id, new.guide_id,
        'guide_confirmation_reminder', 'confirmation_request:' || new.id::text || ':initial',
        false, new.assigned_by
      );
    end if;
  elsif new.change_reason = 'Guide removed from internal assignment workflow'
    and v_previous.guide_id is not null then
    perform public.enqueue_assignment_notification_intent(
      'assignment_removed', new.group_id, v_previous.id, v_previous.guide_id,
      'assignment_changed', 'assignment_removed:' || new.id::text,
      false, new.assigned_by
    );
  end if;
  return null;
end;
$$;
