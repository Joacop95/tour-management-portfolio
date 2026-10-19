create or replace function public.get_group_assignment_notification_history(p_group_id uuid)
returns table (
  event_type text,
  recipient_email text,
  status text,
  is_manual boolean,
  created_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error_safe text
)
language sql
security definer
set search_path = ''
as $$
  select
    o.event_type,
    o.recipient_email,
    o.status,
    o.is_manual,
    o.created_at,
    o.sent_at,
    o.failed_at,
    o.last_error_safe
  from public.assignment_notification_outbox as o
  where o.group_id = p_group_id
    and auth.uid() is not null
    and (
      public.has_permission('planning.view')
      or public.has_permission('assignments.view')
    )
  order by o.created_at desc, o.id desc;
$$;

revoke all on function public.get_group_assignment_notification_history(uuid) from public;
revoke all on function public.get_group_assignment_notification_history(uuid) from anon;
grant execute on function public.get_group_assignment_notification_history(uuid) to authenticated;

comment on function public.get_group_assignment_notification_history(uuid) is
  'Returns display-safe assignment communication history for authorized internal Operations users.';
