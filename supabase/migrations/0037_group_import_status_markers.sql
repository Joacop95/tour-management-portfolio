drop function if exists public.import_group_row(text, uuid, uuid, date, date);

create function public.import_group_row(
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
begin
  if auth.uid() is null or not public.has_permission('import_export.import_excel')
    or not public.has_permission('groups.create') then
    return query select false, 'not_authorized', 'You do not have permission to import groups.', null::uuid; return;
  end if;
  if v_group_status not in ('active', 'cxl', 'fusionado') then
    return query select false, 'invalid_group_status', 'This group import status is not supported.', null::uuid; return;
  end if;
  if v_group_status <> 'active' and p_guide_id is not null then
    return query select false, 'status_guide_conflict', 'Cancelled or merged groups cannot be assigned to a guide during import.', null::uuid; return;
  end if;
  if v_code = '' then return query select false, 'group_code_required', 'Group code is required.', null::uuid; return; end if;
  if position('-' in v_code) = 0 then return query select false, 'invalid_group_code', 'Group code must contain a prefix followed by a hyphen.', null::uuid; return; end if;
  v_prefix := split_part(v_code, '-', 1);
  if v_prefix !~ '^[0-9]+$' then return query select false, 'invalid_group_code', 'Group code prefix must be numeric.', null::uuid; return; end if;

  select m.circuit_id into v_mapped_circuit_id
  from public.group_code_circuit_mappings as m
  where m.prefix = v_prefix and m.is_active = true and m.circuit_id is not null;
  if v_circuit_id is not null and v_mapped_circuit_id is not null and v_circuit_id <> v_mapped_circuit_id then
    return query select false, 'circuit_mismatch', 'Circuit does not match the configured group-code prefix.', null::uuid; return;
  end if;
  v_circuit_id := coalesce(v_circuit_id, v_mapped_circuit_id);
  if v_circuit_id is not null and not exists (select 1 from public.circuits c where c.id=v_circuit_id and c.is_active and not c.is_archived) then
    return query select false, 'unknown_circuit', 'The selected circuit is not available.', null::uuid; return;
  end if;
  if p_guide_id is not null and not exists (select 1 from public.guides g where g.id=p_guide_id and not g.is_archived) then
    return query select false, 'unknown_guide', 'The selected guide is not available.', null::uuid; return;
  end if;
  if p_start_date is not null and v_end_date is null and v_circuit_id is not null then
    select c.default_end_date_offset_days into v_offset from public.circuits c where c.id=v_circuit_id;
    if v_offset is not null then v_end_date := p_start_date + v_offset; end if;
  end if;
  if p_start_date is not null and v_end_date is not null and v_end_date < p_start_date then
    return query select false, 'invalid_date_order', 'End date must be on or after start date.', null::uuid; return;
  end if;
  if exists (select 1 from public.groups g where g.group_code=v_code and not g.is_archived) then
    return query select false, 'group_exists', 'This group already exists and was not overwritten.', null::uuid; return;
  end if;

  insert into public.groups (group_code,circuit_id,start_date,end_date,group_status,assignment_status,confirmation_status)
  values (
    v_code,v_circuit_id,p_start_date,v_end_date,v_group_status::public.group_status,
    (case when p_guide_id is null then 'without_guide' else 'assigned' end)::public.assignment_status,
    (case when p_guide_id is null then 'not_required' else 'pending_confirmation' end)::public.confirmation_status
  )
  returning id into v_group_id;

  if v_group_status = 'active' then
    insert into public.assignments (group_id,guide_id,status,confirmation_status,is_current)
    values (v_group_id,p_guide_id,
      (case when p_guide_id is null then 'without_guide' else 'assigned' end)::public.assignment_status,
      (case when p_guide_id is null then 'not_required' else 'pending_confirmation' end)::public.confirmation_status,true);
  end if;

  return query select true, 'created', 'Group imported.', v_group_id;
end;
$$;

revoke all on function public.import_group_row(text, uuid, uuid, date, date, text) from public;
revoke all on function public.import_group_row(text, uuid, uuid, date, date, text) from anon;
grant execute on function public.import_group_row(text, uuid, uuid, date, date, text) to authenticated;
