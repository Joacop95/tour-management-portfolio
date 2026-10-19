-- Status changes and their assignment cleanup share one transaction.
alter table public.assignment_notification_outbox
  drop constraint assignment_notification_outbox_event_type_check,
  add constraint assignment_notification_outbox_event_type_check check (event_type in (
    'assignment_created', 'assignment_changed_new_guide',
    'assignment_changed_previous_guide', 'assignment_removed',
    'confirmation_request', 'group_information',
    'group_cancelled_for_guide', 'group_merged_for_guide'
  ));

insert into public.email_templates (template_type, language, subject, body)
values
  ('group_cancelled_for_guide', 'english', 'Your assigned group has been cancelled',
   'Your assigned group has been cancelled and is no longer assigned to you. Contact Operations if you have any questions.'),
  ('group_merged_for_guide', 'english', 'Your assigned group has been marked as merged',
   'Your assigned group has been marked as merged and is no longer assigned to you. Contact Operations if you have any questions.')
on conflict (template_type, language) do nothing;

-- Invoker security is intentional: browser table writes cannot bypass the RPC.
create function public.guard_direct_group_status_update()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.group_status is distinct from old.group_status
    and current_user in ('authenticated', 'anon') then
    raise exception using errcode = '42501',
      message = 'Use the group status operation to change status.';
  end if;
  return new;
end;
$$;
revoke all on function public.guard_direct_group_status_update() from public, anon, authenticated;
create trigger guard_direct_group_status_update
before update of group_status on public.groups
for each row execute function public.guard_direct_group_status_update();

-- Serializes assignment writes with status changes, including legacy table writes.
create function public.guard_nonoperational_group_assignment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_status public.group_status;
begin
  if new.is_current and not new.is_archived and new.guide_id is not null then
    select g.group_status into v_status from public.groups as g
    where g.id = new.group_id for update;
    if v_status in ('cxl', 'fusionado') then
      raise exception using errcode = '23514',
        message = 'Reopen this group before assigning a guide.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_nonoperational_group_assignment() from public, anon, authenticated;
create trigger guard_nonoperational_group_assignment
before insert or update on public.assignments
for each row execute function public.guard_nonoperational_group_assignment();

create function public.set_internal_group_status(
  p_group_id uuid,
  p_status public.group_status,
  p_expected_updated_at timestamptz,
  p_expected_assignment_id uuid
)
returns table (success boolean, code text, message text)
language plpgsql security definer set search_path = '' as $$
declare
  v_actor uuid := auth.uid();
  v_now timestamptz := clock_timestamp();
  v_group public.groups%rowtype;
  v_assignment public.assignments%rowtype;
  v_clear_assignment boolean;
  v_event text;
  v_outbox_id uuid;
begin
  if v_actor is null or not public.has_permission('groups.edit') then
    return query select false, 'not_authorized', 'You do not have permission to edit groups.';
    return;
  end if;
  if p_status is null then
    return query select false, 'invalid_status', 'Select a group status.';
    return;
  end if;

  select g.* into v_group from public.groups as g
  where g.id = p_group_id and not g.is_archived for update;
  if not found then
    return query select false, 'group_not_found', 'This group is no longer available.';
    return;
  end if;
  select a.* into v_assignment from public.assignments as a
  where a.group_id = p_group_id and a.is_current and not a.is_archived for update;

  if v_group.updated_at is distinct from p_expected_updated_at
    or v_assignment.id is distinct from p_expected_assignment_id then
    return query select false, 'state_changed', 'This group or assignment changed. Refresh and try again.';
    return;
  end if;
  if v_group.group_status = p_status then
    return query select true, 'no_op', 'Group status is already up to date.';
    return;
  end if;

  -- Reopening legacy cancelled/merged rows also never restores a linked guide.
  v_clear_assignment := p_status in ('cxl', 'fusionado')
    or v_group.group_status in ('cxl', 'fusionado');

  if v_clear_assignment and v_assignment.guide_id is not null then
    update public.assignments as a
    set is_current = false,
        change_reason = 'Guide removed by group status transition to ' || p_status::text,
        changed_at = v_now, changed_by = v_actor,
        updated_at = v_now, updated_by = v_actor
    where a.id = v_assignment.id and a.group_id = p_group_id
      and a.guide_id = v_assignment.guide_id and a.is_current and not a.is_archived;
    if not found then
      raise exception using errcode = '40001', message = 'Assignment changed concurrently.';
    end if;

    update public.availability as av
    set is_archived = true, archived_at = v_now, archived_by = v_actor,
        archive_reason = 'Assignment retired by group status transition.',
        updated_at = v_now, updated_by = v_actor
    where av.assignment_id = v_assignment.id
      and av.guide_id = v_assignment.guide_id
      and av.source = 'assignment_generated'
      and av.status = 'occupied_by_assignment' and not av.is_archived;

    v_event := case
      when p_status = 'cxl' then 'group_cancelled_for_guide'
      when p_status = 'fusionado' then 'group_merged_for_guide'
      when v_group.group_status = 'cxl' then 'group_cancelled_for_guide'
      else 'group_merged_for_guide' end;
    v_outbox_id := public.enqueue_assignment_notification_intent(
      v_event, p_group_id, v_assignment.id, v_assignment.guide_id,
      v_event, v_event || ':' || v_assignment.id::text, false, v_actor
    );
    -- The existing helper skips archived guides; preserve a blocked intent for them.
    if v_outbox_id is null then
      insert into public.assignment_notification_outbox (
        event_type, status, group_id, assignment_id, guide_id, template_key,
        language, requested_by, deduplication_key, last_error_safe
      ) values (
        v_event, 'blocked', p_group_id, v_assignment.id, v_assignment.guide_id,
        v_event, 'english', v_actor, v_event || ':' || v_assignment.id::text,
        'Guide contact is no longer available.'
      );
    end if;
  end if;

  update public.groups as g
  set group_status = p_status,
      assignment_status = case when v_clear_assignment then 'without_guide'::public.assignment_status else g.assignment_status end,
      confirmation_status = case when v_clear_assignment then 'not_required'::public.confirmation_status else g.confirmation_status end,
      updated_at = v_now, updated_by = v_actor
  where g.id = p_group_id and not g.is_archived
    and g.updated_at = p_expected_updated_at;
  if not found then
    raise exception using errcode = '40001', message = 'Group changed concurrently.';
  end if;

  return query select true, 'saved', 'Group status updated.';
end;
$$;
revoke all on function public.set_internal_group_status(uuid, public.group_status, timestamptz, uuid) from public, anon;
grant execute on function public.set_internal_group_status(uuid, public.group_status, timestamptz, uuid) to authenticated;
