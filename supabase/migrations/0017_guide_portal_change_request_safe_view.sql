-- Guide Portal safe change request view for read-only guide access.
--
-- This migration creates a column-safe view only:
-- - No RLS policies are created or changed.
-- - No Guide Portal writes are connected.
-- - No audit_logs RLS is enabled.

create or replace view public.guide_portal_change_requests
with (security_invoker = true)
as
select
  cr.id as change_request_id,
  cr.guide_id,
  cr.group_id,
  cr.assignment_id,
  cr.availability_id,
  cr.request_type,
  cr.request_status,
  cr.requested_at,
  coalesce(cr.guide_message, cr.reason, cr.notes, '') as guide_message,
  cr.decision_reason,
  cr.reviewed_at,
  cr.completed_at,
  cr.cancelled_at,
  g.group_code,
  g.circuit_id,
  c.name as circuit_name,
  c.code as circuit_code,
  g.start_date as group_start_date,
  g.end_date as group_end_date
from public.change_requests cr
left join public.groups g on g.id = cr.group_id
  and g.is_archived = false
left join public.circuits c on c.id = g.circuit_id
  and c.is_archived = false
where cr.is_archived = false
  and cr.archived_at is null
  and cr.guide_id = public.current_user_guide_id();

revoke all on public.guide_portal_change_requests from public;

grant select on public.guide_portal_change_requests to authenticated;

comment on view public.guide_portal_change_requests is
  'Guide Portal safe own change requests view. Excludes internal notes, reviewer/resolver/creator ids, update metadata, archive metadata, role data, and other guides requests.';
