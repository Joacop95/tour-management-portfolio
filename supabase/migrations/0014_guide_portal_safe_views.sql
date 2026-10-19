-- Guide Portal safe views for future Auth-based guide access.
-- This migration creates column-safe views only.
-- It does not enable RLS on new tables and does not create or change policies.

create or replace view public.guide_portal_guides
with (security_invoker = true)
as
select
  g.id as guide_id,
  g.full_name,
  g.authorized_email,
  g.phone,
  g.preferred_language,
  g.languages,
  g.status,
  coalesce(capabilities.circuit_ids, array[]::uuid[]) as circuit_ids,
  coalesce(capabilities.circuit_names, array[]::text[]) as circuit_names
from public.guides g
left join lateral (
  select
    array_agg(gcc.circuit_id order by c.name) as circuit_ids,
    array_agg(c.name order by c.name) as circuit_names
  from public.guide_circuit_capabilities gcc
  join public.circuits c on c.id = gcc.circuit_id
  where gcc.guide_id = g.id
    and gcc.is_active = true
    and c.is_archived = false
) capabilities on true
where g.is_archived = false
  and g.id = public.current_user_guide_id();

create or replace view public.guide_portal_groups
with (security_invoker = true)
as
select
  g.id as group_id,
  g.group_code,
  g.circuit_id,
  c.name as circuit_name,
  c.code as circuit_code,
  g.start_date,
  g.end_date,
  g.group_status,
  a.status as assignment_status,
  a.confirmation_status,
  g.language,
  g.estimated_passengers,
  a.id as current_assignment_id
from public.groups g
join public.assignments a on a.group_id = g.id
join public.circuits c on c.id = g.circuit_id
where g.is_archived = false
  and a.is_current = true
  and a.is_archived = false
  and a.guide_id = public.current_user_guide_id();

create or replace view public.guide_portal_assignments
with (security_invoker = true)
as
select
  a.id as assignment_id,
  a.group_id,
  a.guide_id,
  g.group_code,
  g.circuit_id,
  c.name as circuit_name,
  c.code as circuit_code,
  g.start_date,
  g.end_date,
  a.status as assignment_status,
  a.confirmation_status,
  a.assigned_at,
  a.is_current
from public.assignments a
join public.groups g on g.id = a.group_id
join public.circuits c on c.id = g.circuit_id
where a.is_archived = false
  and a.is_current = true
  and g.is_archived = false
  and a.guide_id = public.current_user_guide_id();

create or replace view public.guide_portal_availability
with (security_invoker = true)
as
select
  av.id as availability_id,
  av.guide_id,
  av.assignment_id,
  av.start_date,
  av.end_date,
  av.status,
  av.source,
  av.notes,
  a.group_id as assignment_group_id,
  g.group_code as assignment_group_code,
  g.start_date as assignment_group_start_date,
  g.end_date as assignment_group_end_date,
  g.circuit_id as assignment_circuit_id,
  c.name as assignment_circuit_name,
  c.code as assignment_circuit_code
from public.availability av
left join public.assignments a on a.id = av.assignment_id
  and a.guide_id = av.guide_id
  and a.is_archived = false
left join public.groups g on g.id = a.group_id
  and g.is_archived = false
left join public.circuits c on c.id = g.circuit_id
where av.is_archived = false
  and av.guide_id = public.current_user_guide_id();

revoke all on public.guide_portal_guides from public;
revoke all on public.guide_portal_groups from public;
revoke all on public.guide_portal_assignments from public;
revoke all on public.guide_portal_availability from public;

grant select on public.guide_portal_guides to authenticated;
grant select on public.guide_portal_groups to authenticated;
grant select on public.guide_portal_assignments to authenticated;
grant select on public.guide_portal_availability to authenticated;

comment on view public.guide_portal_guides is
  'Guide Portal safe guide profile view. Excludes internal notes, internal metrics, sales rankings, change request counters, and admin metadata.';

comment on view public.guide_portal_groups is
  'Guide Portal safe current assigned groups view. Excludes internal notes, merge metadata, audit metadata, and unrelated assignment history.';

comment on view public.guide_portal_assignments is
  'Guide Portal safe current assignments view. Excludes internal assignment notes, actor ids, change reasons, replacement metadata, and unrelated assignment history.';

comment on view public.guide_portal_availability is
  'Guide Portal safe own availability view. Excludes update/archive metadata and other guides availability rows.';
