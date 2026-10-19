-- Operational group/guide import foundations.

alter table public.groups alter column circuit_id drop not null;
alter table public.groups alter column start_date drop not null;
alter table public.groups alter column end_date drop not null;

alter table public.guides alter column authorized_email drop not null;
alter table public.guides add column if not exists birth_date date null;
alter table public.guides add column if not exists city text null;

alter table public.circuits
  add column if not exists default_end_date_offset_days integer null,
  add constraint circuits_default_end_date_offset_days_check
    check (default_end_date_offset_days is null or default_end_date_offset_days >= 0);

create table public.group_code_circuit_mappings (
  prefix text primary key,
  circuit_id uuid null references public.circuits(id),
  configured_circuit_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references public.profiles(id),
  constraint group_code_circuit_mappings_prefix_check check (prefix ~ '^[0-9]+$')
);

create index group_code_circuit_mappings_circuit_id_idx
  on public.group_code_circuit_mappings (circuit_id);

alter table public.group_code_circuit_mappings enable row level security;

create policy "group_code_mappings_select_operational"
on public.group_code_circuit_mappings for select to authenticated
using (
  public.has_permission('import_export.view')
  or public.has_permission('import_export.import_excel')
  or public.has_permission('settings.manage_settings')
);

create policy "group_code_mappings_insert_settings"
on public.group_code_circuit_mappings for insert to authenticated
with check (public.has_permission('settings.manage_settings'));

create policy "group_code_mappings_update_settings"
on public.group_code_circuit_mappings for update to authenticated
using (public.has_permission('settings.manage_settings'))
with check (public.has_permission('settings.manage_settings'));

insert into public.group_code_circuit_mappings (prefix, circuit_id, configured_circuit_name)
select seed.prefix, c.id, seed.circuit_name
from (values
  ('12047','CORAZON'),('12019','GRAN TOUR'),('12402','ALMA'),('12374','3 MARAVILLAS'),
  ('12350','GRAN TOUR'),('12504','DIVINA'),('12492','3 MARAVILLAS II'),('12463','CORAZON'),
  ('12497','EPM 15 BAR'),('12271','EPM 15'),('12549','GRAN TOUR'),('12819','GRAN TOUR'),
  ('12550','GRAN TOUR B 20'),('12498','EPM 15 BAR'),('12400','UK+IE VER'),('12449','SUIZA'),
  ('12422','DIVINA'),('12526','GRAN TOUR B'),('12506','3 MARAVILLAS II'),('12509','HOLA EUROPA'),
  ('12457','CD IT'),('12033','MAGIA'),('12121','EPM 17'),('12535','HOLA EUROPA B'),
  ('12465','CORAZON 10'),('12524','GRAN TOUR'),('12279','3 MARAVILLAS'),('12919','GRAN TOUR'),
  ('12460','TESOROS 19'),('12531','GRAN TOUR'),('12540','MISTERIOS - SAH'),('12525','GRAN TOUR B'),
  ('12979','3 MARAVILLAS'),('12542','CORAZON'),('12318','GRAN TOUR'),('12553','UK+IE VER'),
  ('12559','MAGIA'),('12516','EPM 17'),('12517','EPM 17'),('12502','ALMA B')
) as seed(prefix, circuit_name)
left join public.circuits as c on upper(trim(c.name)) = seed.circuit_name
on conflict (prefix) do nothing;

update public.circuits set default_end_date_offset_days = 7
where upper(trim(name)) = 'CORAZON' and default_end_date_offset_days is null;

create or replace function public.import_group_row(
  p_group_code text,
  p_circuit_id uuid default null,
  p_guide_id uuid default null,
  p_start_date date default null,
  p_end_date date default null
)
returns table (success boolean, code text, message text, group_id uuid)
language plpgsql security definer set search_path = '' as $$
declare
  v_code text := trim(coalesce(p_group_code, ''));
  v_prefix text;
  v_mapped_circuit_id uuid;
  v_circuit_id uuid := p_circuit_id;
  v_end_date date := p_end_date;
  v_offset integer;
  v_group_id uuid;
begin
  if auth.uid() is null or not public.has_permission('import_export.import_excel')
    or not public.has_permission('groups.create') then
    return query select false, 'not_authorized', 'You do not have permission to import groups.', null::uuid; return;
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
  values (v_code,v_circuit_id,p_start_date,v_end_date,'active',
    (case when p_guide_id is null then 'without_guide' else 'assigned' end)::public.assignment_status,
    (case when p_guide_id is null then 'not_required' else 'pending_confirmation' end)::public.confirmation_status)
  returning id into v_group_id;
  insert into public.assignments (group_id,guide_id,status,confirmation_status,is_current)
  values (v_group_id,p_guide_id,
    (case when p_guide_id is null then 'without_guide' else 'assigned' end)::public.assignment_status,
    (case when p_guide_id is null then 'not_required' else 'pending_confirmation' end)::public.confirmation_status,true);
  return query select true, 'created', 'Group imported.', v_group_id;
end; $$;

revoke all on function public.import_group_row(text,uuid,uuid,date,date) from public, anon;
grant execute on function public.import_group_row(text,uuid,uuid,date,date) to authenticated;

create or replace function public.import_guide_row(
  p_full_name text, p_phone text default null, p_birth_date date default null,
  p_city text default null, p_email text default null
)
returns table (success boolean, code text, message text, guide_id uuid)
language plpgsql security definer set search_path = '' as $$
declare v_name text:=trim(coalesce(p_full_name,'')); v_email text:=lower(trim(coalesce(p_email,''))); v_existing uuid; v_id uuid;
begin
  if auth.uid() is null or not public.has_permission('import_export.import_excel') then
    return query select false,'not_authorized','You do not have permission to import guides.',null::uuid; return;
  end if;
  if v_name='' then return query select false,'name_required','Guide name is required.',null::uuid; return; end if;
  if v_email<>'' and v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return query select false,'invalid_email','Invalid email format.',null::uuid; return;
  end if;
  if v_email<>'' then
    select g.id into v_existing
    from public.guides g
    where not g.is_archived
      and (
        lower(trim(coalesce(g.authorized_email,'')))=v_email
        or exists (
          select 1 from public.guide_authorized_emails e
          where e.guide_id=g.id and e.normalized_email=v_email and e.status<>'revoked'
        )
      )
    limit 1;
  end if;
  if v_existing is not null then
    if not public.has_permission('guides.edit') then return query select false,'not_authorized','You do not have permission to update guides.',null::uuid; return; end if;
    update public.guides g set full_name=v_name,phone=coalesce(nullif(trim(p_phone),''),g.phone),birth_date=coalesce(p_birth_date,g.birth_date),city=coalesce(nullif(trim(p_city),''),g.city),updated_at=now() where g.id=v_existing returning g.id into v_id;
    return query select true,'updated','Existing guide updated by exact email match.',v_id; return;
  end if;
  if exists(select 1 from public.guides g where lower(regexp_replace(trim(g.full_name),'\s+',' ','g'))=lower(regexp_replace(v_name,'\s+',' ','g')) and not g.is_archived) then
    return query select false,'possible_duplicate','A guide with this name already exists. Review it manually.',null::uuid; return;
  end if;
  if not public.has_permission('guides.create') then return query select false,'not_authorized','You do not have permission to create guides.',null::uuid; return; end if;
  insert into public.guides(full_name,authorized_email,phone,birth_date,city,status) values(v_name,nullif(v_email,''),nullif(trim(p_phone),''),p_birth_date,nullif(trim(p_city),''),'active') returning id into v_id;
  return query select true,'created','Guide imported. Login authorization was not created.',v_id;
end; $$;

revoke all on function public.import_guide_row(text,text,date,text,text) from public, anon;
grant execute on function public.import_guide_row(text,text,date,text,text) to authenticated;

comment on table public.group_code_circuit_mappings is 'Exact numeric group-code prefix to circuit configuration. Null circuit ids preserve unresolved requested mappings without affecting imports.';
