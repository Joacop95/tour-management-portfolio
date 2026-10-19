-- CIRCUIT-DATA-1: operational circuit master data supplied for Group Import.
-- Names are inserted exactly as provided. Optional codes, regions, aliases,
-- notes, and durations remain null, except for the requested CORAZON +7 offset.

insert into public.circuits (name)
select seed.name
from (values
  ('CORAZON'),
  ('GRAN TOUR'),
  ('ALMA'),
  ('3 MARAVILLAS'),
  ('DIVINA'),
  ('3 MARAVILLAS II'),
  ('EPM 15 BAR'),
  ('EPM 15'),
  ('GRAN TOUR B 20'),
  ('UK+IE VER'),
  ('SUIZA'),
  ('GRAN TOUR B'),
  ('HOLA EUROPA'),
  ('CD IT'),
  ('MAGIA'),
  ('EPM 17'),
  ('HOLA EUROPA B'),
  ('CORAZON 10'),
  ('TESOROS 19'),
  ('MISTERIOS - SAH'),
  ('ALMA B')
) as seed(name)
where not exists (
  select 1
  from public.circuits as circuit
  where lower(btrim(circuit.name)) = lower(btrim(seed.name))
);

update public.circuits
set default_end_date_offset_days = 7,
    updated_at = now()
where lower(btrim(name)) = lower('CORAZON')
  and default_end_date_offset_days is null;

update public.group_code_circuit_mappings as mapping
set circuit_id = circuit.id,
    is_active = true,
    updated_at = now()
from public.circuits as circuit
where lower(btrim(circuit.name)) = lower(btrim(mapping.configured_circuit_name))
  and circuit.is_archived = false
  and mapping.circuit_id is distinct from circuit.id;

do $$
declare
  v_unresolved_count integer;
begin
  select count(*)
  into v_unresolved_count
  from public.group_code_circuit_mappings
  where circuit_id is null;

  if v_unresolved_count <> 0 then
    raise exception 'Operational group-code mappings remain unresolved: %', v_unresolved_count;
  end if;
end;
$$;

comment on column public.circuits.default_end_date_offset_days is
  'Calendar-day offset used to derive a missing Group import end date. Null means no default.';
