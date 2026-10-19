-- PROD-3A: Guides needs current operational assignment counts, not mock groups
-- or replacement/history assignment rows.
create function public.get_current_guide_assignment_counts(p_guide_ids uuid[])
returns table (guide_id uuid, assigned_group_count bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.uid() is null or not public.has_permission('guides.view') then
    raise exception using errcode = '42501', message = 'You do not have permission to view guide counts.';
  end if;
  if p_guide_ids is null or cardinality(p_guide_ids) > 100 then
    raise exception using errcode = '22023', message = 'Select up to 100 guides.';
  end if;

  return query
  select a.guide_id, count(*)::bigint
  from public.assignments as a
  join public.groups as g on g.id = a.group_id
  where a.guide_id = any(p_guide_ids)
    and a.is_current and not a.is_archived
    and a.status = 'assigned'
    and not g.is_archived
    and g.group_status not in ('cxl', 'fusionado')
  group by a.guide_id;
end;
$$;
revoke all on function public.get_current_guide_assignment_counts(uuid[]) from public, anon;
grant execute on function public.get_current_guide_assignment_counts(uuid[]) to authenticated;

insert into public.translation_entries (key, context, description, english_source)
values (
  'dashboard.read_error', 'Dashboard',
  'Operational Dashboard data could not be loaded.',
  'Unable to load Dashboard data. Refresh and try again.'
)
on conflict (key) do nothing;
