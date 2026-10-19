-- Transactional assignment notification intents. External delivery is intentionally deferred.

create table public.assignment_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_type text not null check (event_type in (
    'assignment_created',
    'assignment_changed_new_guide',
    'assignment_changed_previous_guide',
    'assignment_removed',
    'confirmation_request',
    'group_information'
  )),
  status text not null default 'pending' check (status in (
    'pending', 'processing', 'sent', 'failed', 'blocked'
  )),
  group_id uuid not null references public.groups(id),
  assignment_id uuid null references public.assignments(id),
  guide_id uuid not null references public.guides(id),
  recipient_email text null,
  template_key text not null,
  language public.supported_language not null default 'english',
  is_manual boolean not null default false,
  requested_by uuid null references public.profiles(id),
  deduplication_key text null unique,
  attempt_count integer not null default 0 check (attempt_count >= 0),
  last_error_safe text null,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  failed_at timestamptz null,
  updated_at timestamptz not null default now()
);

create index assignment_notification_outbox_group_created_idx
  on public.assignment_notification_outbox (group_id, created_at desc);
create index assignment_notification_outbox_status_created_idx
  on public.assignment_notification_outbox (status, created_at);

alter table public.assignment_notification_outbox enable row level security;

revoke all on table public.assignment_notification_outbox from public;
revoke all on table public.assignment_notification_outbox from anon;
revoke all on table public.assignment_notification_outbox from authenticated;

create or replace function public.enqueue_assignment_notification_intent(
  p_event_type text,
  p_group_id uuid,
  p_assignment_id uuid,
  p_guide_id uuid,
  p_template_key text,
  p_deduplication_key text,
  p_is_manual boolean,
  p_requested_by uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_preferred_language public.supported_language;
  v_language public.supported_language;
  v_has_template boolean;
  v_status text := 'pending';
  v_error text;
  v_id uuid;
begin
  select nullif(trim(g.authorized_email), ''), coalesce(g.preferred_language, 'english')
  into v_email, v_preferred_language
  from public.guides as g
  where g.id = p_guide_id and g.is_archived = false;

  if not found then
    return null;
  end if;

  select exists (
    select 1 from public.email_templates as et
    where et.template_type = p_template_key
      and et.language = v_preferred_language
      and et.is_archived = false
      and trim(et.subject) <> ''
      and trim(et.body) <> ''
  ) into v_has_template;

  if v_has_template then
    v_language := v_preferred_language;
  else
    v_language := 'english';
    select exists (
      select 1 from public.email_templates as et
      where et.template_type = p_template_key
        and et.language = 'english'
        and et.is_archived = false
        and trim(et.subject) <> ''
        and trim(et.body) <> ''
    ) into v_has_template;
  end if;

  if v_email is null or v_email !~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    v_status := 'blocked';
    v_error := 'No guide email available.';
  elsif not v_has_template then
    v_status := 'blocked';
    v_error := 'Email template content is not configured.';
  end if;

  insert into public.assignment_notification_outbox (
    event_type, status, group_id, assignment_id, guide_id,
    recipient_email, template_key, language, is_manual, requested_by,
    deduplication_key, last_error_safe
  ) values (
    p_event_type, v_status, p_group_id, p_assignment_id, p_guide_id,
    v_email, p_template_key, v_language, p_is_manual, p_requested_by,
    p_deduplication_key, v_error
  )
  on conflict (deduplication_key) do nothing
  returning id into v_id;

  if v_id is null and p_deduplication_key is not null then
    select o.id into v_id
    from public.assignment_notification_outbox as o
    where o.deduplication_key = p_deduplication_key;
  end if;

  return v_id;
end;
$$;

revoke all on function public.enqueue_assignment_notification_intent(text, uuid, uuid, uuid, text, text, boolean, uuid) from public;
revoke all on function public.enqueue_assignment_notification_intent(text, uuid, uuid, uuid, text, text, boolean, uuid) from anon;
revoke all on function public.enqueue_assignment_notification_intent(text, uuid, uuid, uuid, text, text, boolean, uuid) from authenticated;

create or replace function public.capture_internal_assignment_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.assignments%rowtype;
begin
  if new.change_reason not in (
    'Guide assigned from internal assignment workflow',
    'Guide changed from internal assignment workflow',
    'Guide removed from internal assignment workflow'
  ) then
    return null;
  end if;

  select a.* into v_previous
  from public.assignments as a
  where a.replaced_by_assignment_id = new.id
  order by a.created_at desc
  limit 1;

  if new.change_reason = 'Guide assigned from internal assignment workflow'
    and new.guide_id is not null then
    perform public.enqueue_assignment_notification_intent(
      'assignment_created', new.group_id, new.id, new.guide_id,
      'assigned_groups_email', 'assignment_created:' || new.id::text,
      false, new.assigned_by
    );
    perform public.enqueue_assignment_notification_intent(
      'confirmation_request', new.group_id, new.id, new.guide_id,
      'guide_confirmation_reminder', 'confirmation_request:' || new.id::text || ':initial',
      false, new.assigned_by
    );
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
    perform public.enqueue_assignment_notification_intent(
      'confirmation_request', new.group_id, new.id, new.guide_id,
      'guide_confirmation_reminder', 'confirmation_request:' || new.id::text || ':initial',
      false, new.assigned_by
    );
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

revoke all on function public.capture_internal_assignment_notifications() from public;
revoke all on function public.capture_internal_assignment_notifications() from anon;
revoke all on function public.capture_internal_assignment_notifications() from authenticated;

create constraint trigger capture_internal_assignment_notifications_trigger
after insert on public.assignments
deferrable initially deferred
for each row execute function public.capture_internal_assignment_notifications();

create or replace function public.enqueue_manual_assignment_notification(
  p_group_id uuid,
  p_event_type text
)
returns table (success boolean, code text, message text, outbox_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_assignment public.assignments%rowtype;
  v_outbox_id uuid;
  v_status text;
  v_template_key text;
  v_dedup_key text;
begin
  if v_actor_id is null then
    return query select false, 'not_authenticated', 'Sign in before requesting guide communication.', null::uuid, null::text;
    return;
  end if;

  if p_event_type = 'confirmation_request' then
    if not public.has_permission('assignments.confirm_guide') then
      return query select false, 'not_authorized', 'You do not have permission to request guide confirmation.', null::uuid, null::text;
      return;
    end if;
    v_template_key := 'guide_confirmation_reminder';
  elsif p_event_type = 'group_information' then
    if not (
      public.has_permission('assignments.assign_guide')
      or public.has_permission('assignments.change_guide')
    ) then
      return query select false, 'not_authorized', 'You do not have permission to send group information.', null::uuid, null::text;
      return;
    end if;
    v_template_key := 'assigned_groups_email';
  else
    return query select false, 'invalid_event', 'This communication type is not supported.', null::uuid, null::text;
    return;
  end if;

  select a.* into v_assignment
  from public.assignments as a
  where a.group_id = p_group_id
    and a.is_current = true
    and a.is_archived = false
  for share;

  if v_assignment.id is null or v_assignment.guide_id is null or v_assignment.status <> 'assigned' then
    return query select false, 'assignment_not_eligible', 'This group does not have a current assigned guide.', null::uuid, null::text;
    return;
  end if;

  if p_event_type = 'confirmation_request'
    and v_assignment.confirmation_status <> 'pending_confirmation' then
    return query select false, 'confirmation_not_pending', 'This guide no longer needs to confirm the assignment.', null::uuid, null::text;
    return;
  end if;

  v_dedup_key := 'manual:' || p_event_type || ':' || v_assignment.id::text || ':' ||
    to_char(date_trunc('minute', now()), 'YYYYMMDDHH24MI');

  v_outbox_id := public.enqueue_assignment_notification_intent(
    p_event_type, p_group_id, v_assignment.id, v_assignment.guide_id,
    v_template_key, v_dedup_key, true, v_actor_id
  );

  select o.status into v_status
  from public.assignment_notification_outbox as o
  where o.id = v_outbox_id;

  return query select true,
    case when v_status = 'blocked' then 'queued_blocked' else 'queued' end,
    case when v_status = 'blocked'
      then 'Communication recorded but cannot be delivered until its email or template is configured.'
      else 'Communication queued. Delivery provider is not configured.'
    end,
    v_outbox_id, v_status;
end;
$$;

create or replace function public.get_group_assignment_notification_status(p_group_id uuid)
returns table (
  event_type text,
  status text,
  created_at timestamptz,
  sent_at timestamptz,
  failed_at timestamptz,
  last_error_safe text
)
language sql
security definer
set search_path = ''
as $$
  select distinct on (o.event_type)
    o.event_type, o.status, o.created_at, o.sent_at, o.failed_at, o.last_error_safe
  from public.assignment_notification_outbox as o
  where o.group_id = p_group_id
    and auth.uid() is not null
    and (
      public.has_permission('planning.view')
      or public.has_permission('assignments.view')
    )
  order by o.event_type, o.created_at desc;
$$;

revoke all on function public.enqueue_manual_assignment_notification(uuid, text) from public;
revoke all on function public.enqueue_manual_assignment_notification(uuid, text) from anon;
grant execute on function public.enqueue_manual_assignment_notification(uuid, text) to authenticated;

revoke all on function public.get_group_assignment_notification_status(uuid) from public;
revoke all on function public.get_group_assignment_notification_status(uuid) from anon;
grant execute on function public.get_group_assignment_notification_status(uuid) to authenticated;

comment on table public.assignment_notification_outbox is
  'Transactional assignment email intents. Delivery remains pending until a secure provider worker is configured.';
