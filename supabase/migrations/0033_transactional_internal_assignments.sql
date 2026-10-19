-- Atomic internal assignment, guide-change, removal, and confirmation workflows.

create or replace function public.set_internal_group_guide(
  p_group_id uuid,
  p_new_guide_id uuid,
  p_expected_assignment_id uuid default null
)
returns table (
  success boolean,
  code text,
  message text,
  operation text,
  assignment_id uuid,
  previous_assignment_id uuid,
  group_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now timestamptz := now();
  v_group public.groups%rowtype;
  v_current public.assignments%rowtype;
  v_new_assignment_id uuid;
  v_operation text;
  v_required_permission text;
begin
  if v_actor_id is null then
    return query select false, 'not_authenticated', 'Sign in before changing an assignment.',
      null::text, null::uuid, null::uuid, p_group_id;
    return;
  end if;

  if not (
    public.has_permission('assignments.assign_guide')
    or public.has_permission('assignments.change_guide')
  ) then
    return query select false, 'not_authorized',
      'You do not have permission to perform assignment actions.',
      null::text, null::uuid, null::uuid, p_group_id;
    return;
  end if;

  select g.* into v_group
  from public.groups as g
  where g.id = p_group_id and g.is_archived = false
  for update;

  if not found then
    return query select false, 'group_not_found', 'The selected group no longer exists.',
      null::text, null::uuid, null::uuid, p_group_id;
    return;
  end if;

  select a.* into v_current
  from public.assignments as a
  where a.group_id = p_group_id
    and a.is_current = true
    and a.is_archived = false
  for update;

  if v_current.id is distinct from p_expected_assignment_id then
    return query select false, 'assignment_state_changed',
      'The assignment changed while you were working. Refresh and try again.',
      null::text, v_current.id, p_expected_assignment_id, p_group_id;
    return;
  end if;

  if p_new_guide_id is not null then
    perform 1
    from public.guides as gd
    where gd.id = p_new_guide_id
      and gd.is_archived = false
      and gd.status = 'active';

    if not found then
      return query select false, 'guide_not_eligible',
        'The selected guide is not active or no longer exists.',
        null::text, null::uuid, v_current.id, p_group_id;
      return;
    end if;
  end if;

  if v_current.id is not null
    and v_current.guide_id is not distinct from p_new_guide_id
    and v_current.status = (case when p_new_guide_id is null then 'without_guide' else 'assigned' end)::public.assignment_status then
    return query select true, 'already_assigned', 'The assignment is already up to date.',
      'no_op', v_current.id, v_current.id, p_group_id;
    return;
  end if;

  if p_new_guide_id is null then
    v_operation := 'assignment_removed';
    v_required_permission := 'assignments.change_guide';
  elsif v_current.guide_id is null then
    v_operation := 'assignment_created';
    v_required_permission := 'assignments.assign_guide';
  else
    v_operation := 'assignment_changed';
    v_required_permission := 'assignments.change_guide';
  end if;

  if not public.has_permission(v_required_permission) then
    return query select false, 'not_authorized',
      'You do not have permission to perform this assignment action.',
      v_operation, null::uuid, v_current.id, p_group_id;
    return;
  end if;

  if v_current.id is not null then
    update public.assignments as a
    set is_current = false,
        change_reason = case v_operation
          when 'assignment_removed' then 'Guide removed from internal assignment workflow'
          when 'assignment_changed' then 'Guide changed from internal assignment workflow'
          else 'Guide assigned from internal assignment workflow'
        end,
        changed_at = v_now,
        changed_by = v_actor_id,
        updated_at = v_now,
        updated_by = v_actor_id
    where a.id = v_current.id
      and a.is_current = true
      and a.is_archived = false;

    if not found then
      raise exception using errcode = '40001', message = 'Assignment state changed concurrently.';
    end if;
  end if;

  insert into public.assignments (
    group_id,
    guide_id,
    status,
    confirmation_status,
    assigned_at,
    assigned_by,
    confirmed_at,
    confirmed_by,
    is_current,
    change_reason,
    changed_at,
    changed_by,
    created_at,
    updated_at,
    updated_by
  ) values (
    p_group_id,
    p_new_guide_id,
    (case when p_new_guide_id is null then 'without_guide' else 'assigned' end)::public.assignment_status,
    (case when p_new_guide_id is null then 'not_required' else 'pending_confirmation' end)::public.confirmation_status,
    v_now,
    v_actor_id,
    null,
    null,
    true,
    case v_operation
      when 'assignment_removed' then 'Guide removed from internal assignment workflow'
      when 'assignment_changed' then 'Guide changed from internal assignment workflow'
      else 'Guide assigned from internal assignment workflow'
    end,
    v_now,
    v_actor_id,
    v_now,
    v_now,
    v_actor_id
  )
  returning id into v_new_assignment_id;

  if v_current.id is not null then
    update public.assignments as a
    set replaced_by_assignment_id = v_new_assignment_id,
        updated_at = v_now,
        updated_by = v_actor_id
    where a.id = v_current.id;

    update public.availability as av
    set is_archived = true,
        archived_at = v_now,
        archived_by = v_actor_id,
        archive_reason = 'Assignment replaced from internal assignment workflow.',
        updated_at = v_now,
        updated_by = v_actor_id
    where av.assignment_id = v_current.id
      and av.source = 'assignment_generated'
      and av.status = 'occupied_by_assignment'
      and av.is_archived = false;
  end if;

  if p_new_guide_id is not null
    and v_group.group_status not in ('cxl', 'fusionado') then
    insert into public.availability (
      guide_id,
      assignment_id,
      status,
      source,
      start_date,
      end_date,
      notes,
      created_at,
      updated_at,
      updated_by
    ) values (
      p_new_guide_id,
      v_new_assignment_id,
      'occupied_by_assignment',
      'assignment_generated',
      v_group.start_date,
      v_group.end_date,
      'Generated from group assignment',
      v_now,
      v_now,
      v_actor_id
    );
  end if;

  update public.groups as g
  set assignment_status = (case when p_new_guide_id is null then 'without_guide' else 'assigned' end)::public.assignment_status,
      confirmation_status = (case when p_new_guide_id is null then 'not_required' else 'pending_confirmation' end)::public.confirmation_status,
      updated_at = v_now,
      updated_by = v_actor_id
  where g.id = p_group_id and g.is_archived = false;

  if not found then
    raise exception using errcode = '40001', message = 'Group state changed concurrently.';
  end if;

  return query select true, 'saved',
    case v_operation
      when 'assignment_created' then 'Guide assigned. Confirmation is pending.'
      when 'assignment_changed' then 'Guide changed. Confirmation is pending.'
      else 'Guide removed.'
    end,
    v_operation, v_new_assignment_id, v_current.id, p_group_id;
end;
$$;

create or replace function public.confirm_internal_group_guide(
  p_group_id uuid,
  p_expected_assignment_id uuid
)
returns table (
  success boolean,
  code text,
  message text,
  assignment_id uuid,
  group_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_now timestamptz := now();
  v_group public.groups%rowtype;
  v_assignment public.assignments%rowtype;
begin
  if v_actor_id is null or not public.has_permission('assignments.confirm_guide') then
    return query select false, 'not_authorized',
      'You do not have permission to confirm guide assignments.', null::uuid, p_group_id;
    return;
  end if;

  select g.* into v_group
  from public.groups as g
  where g.id = p_group_id and g.is_archived = false
  for update;

  if not found then
    return query select false, 'group_not_found',
      'The selected group no longer exists.', null::uuid, p_group_id;
    return;
  end if;

  select a.* into v_assignment
  from public.assignments as a
  where a.group_id = p_group_id
    and a.is_current = true
    and a.is_archived = false
  for update;

  if v_assignment.id is distinct from p_expected_assignment_id then
    return query select false, 'assignment_state_changed',
      'The assignment changed while you were working. Refresh and try again.',
      v_assignment.id, p_group_id;
    return;
  end if;

  if v_assignment.id is null
    or v_assignment.guide_id is null
    or v_assignment.status <> 'assigned'
    or v_assignment.confirmation_status <> 'pending_confirmation' then
    return query select false, 'assignment_not_eligible',
      'This assignment does not require confirmation.', v_assignment.id, p_group_id;
    return;
  end if;

  update public.assignments as a
  set confirmation_status = 'confirmed',
      confirmed_at = v_now,
      confirmed_by = v_actor_id,
      updated_at = v_now,
      updated_by = v_actor_id
  where a.id = v_assignment.id
    and a.is_current = true
    and a.is_archived = false
    and a.confirmation_status = 'pending_confirmation';

  if not found then
    raise exception using errcode = '40001', message = 'Assignment state changed concurrently.';
  end if;

  update public.groups as g
  set assignment_status = 'assigned',
      confirmation_status = 'confirmed',
      updated_at = v_now,
      updated_by = v_actor_id
  where g.id = p_group_id and g.is_archived = false;

  if not found then
    raise exception using errcode = '40001', message = 'Group state changed concurrently.';
  end if;

  return query select true, 'confirmed', 'Guide confirmed.', v_assignment.id, p_group_id;
end;
$$;

revoke all on function public.set_internal_group_guide(uuid, uuid, uuid) from public;
revoke all on function public.set_internal_group_guide(uuid, uuid, uuid) from anon;
grant execute on function public.set_internal_group_guide(uuid, uuid, uuid) to authenticated;

revoke all on function public.confirm_internal_group_guide(uuid, uuid) from public;
revoke all on function public.confirm_internal_group_guide(uuid, uuid) from anon;
grant execute on function public.confirm_internal_group_guide(uuid, uuid) to authenticated;

comment on function public.set_internal_group_guide(uuid, uuid, uuid) is
  'Atomically assigns, changes, or removes a guide using real assignment permissions and an expected-current-assignment concurrency token.';
comment on function public.confirm_internal_group_guide(uuid, uuid) is
  'Atomically confirms the current internal guide assignment and its group summary using real assignments.confirm_guide authority.';
