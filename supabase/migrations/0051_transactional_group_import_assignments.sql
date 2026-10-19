-- Group imports with a Guide must use the same assignment authority and
-- side effects as Planning and Groups. The import remains create-only.

create or replace function public.import_group_row(
  p_group_code text,
  p_circuit_id uuid,
  p_guide_id uuid,
  p_start_date date,
  p_end_date date,
  p_group_status text
)
returns table (success boolean, code text, message text, group_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := trim(coalesce(p_group_code, ''));
  v_prefix text;
  v_mapped_circuit_id uuid;
  v_circuit_id uuid := p_circuit_id;
  v_end_date date := p_end_date;
  v_offset integer;
  v_group_id uuid;
  v_group_status text := lower(trim(coalesce(p_group_status, 'active')));
  v_assignment record;
begin
  if auth.uid() is null
    or not public.has_permission('import_export.import_excel')
    or not public.has_permission('groups.create') then
    return query select false, 'not_authorized',
      'You do not have permission to import groups.', null::uuid;
    return;
  end if;

  if v_group_status not in ('active', 'cxl', 'fusionado') then
    return query select false, 'invalid_group_status',
      'This group import status is not supported.', null::uuid;
    return;
  end if;

  if v_group_status <> 'active' and p_guide_id is not null then
    return query select false, 'status_guide_conflict',
      'Cancelled or merged groups cannot be assigned to a guide during import.',
      null::uuid;
    return;
  end if;

  if p_guide_id is not null
    and not public.has_permission('assignments.assign_guide') then
    return query select false, 'not_authorized',
      'You do not have permission to assign guides during group import.',
      null::uuid;
    return;
  end if;

  if v_code = '' then
    return query select false, 'group_code_required',
      'Group code is required.', null::uuid;
    return;
  end if;

  if v_code ~ '^[0-9]+-.+$' then
    v_prefix := split_part(v_code, '-', 1);

    select mapping.circuit_id
    into v_mapped_circuit_id
    from public.group_code_circuit_mappings as mapping
    where mapping.prefix = v_prefix
      and mapping.is_active = true
      and mapping.circuit_id is not null;
  end if;

  if v_circuit_id is not null
    and v_mapped_circuit_id is not null
    and v_circuit_id <> v_mapped_circuit_id then
    return query select false, 'circuit_mismatch',
      'Circuit does not match the configured group-code prefix.', null::uuid;
    return;
  end if;

  v_circuit_id := coalesce(v_circuit_id, v_mapped_circuit_id);

  if v_circuit_id is not null and not exists (
    select 1
    from public.circuits as circuit
    where circuit.id = v_circuit_id
      and circuit.is_active
      and not circuit.is_archived
  ) then
    return query select false, 'unknown_circuit',
      'The selected circuit is not available.', null::uuid;
    return;
  end if;

  if p_guide_id is not null and not exists (
    select 1
    from public.guides as guide
    where guide.id = p_guide_id
      and guide.status = 'active'
      and not guide.is_archived
  ) then
    return query select false, 'guide_not_eligible',
      'The selected guide is not active or no longer exists.', null::uuid;
    return;
  end if;

  if p_start_date is not null
    and v_end_date is null
    and v_circuit_id is not null then
    select circuit.default_end_date_offset_days
    into v_offset
    from public.circuits as circuit
    where circuit.id = v_circuit_id;

    if v_offset is not null then
      v_end_date := p_start_date + v_offset;
    end if;
  end if;

  if p_start_date is not null
    and v_end_date is not null
    and v_end_date < p_start_date then
    return query select false, 'invalid_date_order',
      'End date must be on or after start date.', null::uuid;
    return;
  end if;

  if p_guide_id is not null
    and (p_start_date is null or v_end_date is null) then
    return query select false, 'assignment_dates_required',
      'Start and end dates are required when importing a group with a guide.',
      null::uuid;
    return;
  end if;

  if exists (
    select 1
    from public.groups as existing_group
    where existing_group.group_code = v_code
  ) then
    return query select false, 'group_exists',
      'This group already exists and was not overwritten.', null::uuid;
    return;
  end if;

  insert into public.groups (
    group_code,
    circuit_id,
    start_date,
    end_date,
    group_status,
    assignment_status,
    confirmation_status
  )
  values (
    v_code,
    v_circuit_id,
    p_start_date,
    v_end_date,
    v_group_status::public.group_status,
    'without_guide',
    'not_required'
  )
  returning id into v_group_id;

  if v_group_status = 'active' and p_guide_id is null then
    insert into public.assignments (
      group_id,
      guide_id,
      status,
      confirmation_status,
      is_current,
      assigned_by,
      updated_by
    )
    values (
      v_group_id,
      null,
      'without_guide',
      'not_required',
      true,
      auth.uid(),
      auth.uid()
    );
  elsif v_group_status = 'active' then
    select *
    into v_assignment
    from public.set_internal_group_guide(v_group_id, p_guide_id, null);

    if not coalesce(v_assignment.success, false) then
      raise exception using
        errcode = 'P0001',
        message = 'Imported group assignment could not be completed.';
    end if;
  end if;

  return query select true, 'created', 'Group imported.', v_group_id;
end;
$$;

revoke all on function public.import_group_row(text, uuid, uuid, date, date, text)
  from public, anon, authenticated;
grant execute on function public.import_group_row(text, uuid, uuid, date, date, text)
  to authenticated;

comment on function public.import_group_row(text, uuid, uuid, date, date, text) is
  'Create-only group import. Active rows with a Guide delegate to the transactional assignment workflow, including occupied availability and notification intents.';
