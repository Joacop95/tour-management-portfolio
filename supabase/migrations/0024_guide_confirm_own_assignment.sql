-- Guide-scoped assignment confirmation for the authenticated Guide Portal user.
-- This does not grant guides direct UPDATE access to assignments or groups.

create or replace function public.confirm_own_guide_assignment(
  p_assignment_id uuid
)
returns table (
  success boolean,
  code text,
  message text,
  assignment_id uuid,
  group_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_guide_id uuid;
  v_assignment_id uuid;
  v_group_id uuid;
  v_now timestamptz := now();
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated',
      'Sign in before confirming an assignment.', null::uuid, null::uuid;
    return;
  end if;

  select p.guide_id
  into v_guide_id
  from public.profiles as p
  where p.id = v_auth_user_id;

  if v_guide_id is null then
    return query select false, 'guide_not_linked',
      'This account is not linked to a guide profile.', null::uuid, null::uuid;
    return;
  end if;

  select a.id, a.group_id
  into v_assignment_id, v_group_id
  from public.assignments as a
  join public.groups as g on g.id = a.group_id
  where a.id = p_assignment_id
    and a.guide_id = v_guide_id
    and a.is_current = true
    and a.is_archived = false
    and a.status = 'assigned'
    and a.confirmation_status = 'pending_confirmation'
    and g.is_archived = false
    and g.group_status = 'active'
  for update of a, g;

  if v_assignment_id is null then
    return query select false, 'assignment_not_eligible',
      'This assignment is not available for confirmation.', null::uuid, null::uuid;
    return;
  end if;

  update public.assignments as a
  set confirmation_status = 'confirmed',
      confirmed_at = coalesce(a.confirmed_at, v_now),
      confirmed_by = v_auth_user_id,
      updated_at = v_now
  where a.id = v_assignment_id
    and a.guide_id = v_guide_id
    and a.group_id = v_group_id
    and a.is_current = true
    and a.is_archived = false
    and a.status = 'assigned'
    and a.confirmation_status = 'pending_confirmation';

  if not found then
    return query select false, 'assignment_not_eligible',
      'This assignment is not available for confirmation.', null::uuid, null::uuid;
    return;
  end if;

  update public.groups as g
  set confirmation_status = 'confirmed',
      updated_at = v_now
  where g.id = v_group_id
    and g.is_archived = false
    and g.group_status = 'active';

  if not found then
    raise exception using
      errcode = 'P0001',
      message = 'Assignment is no longer eligible for confirmation.';
  end if;

  return query select true, 'confirmed', 'Assignment confirmed.',
    v_assignment_id, v_group_id;
end;
$$;

revoke all on function public.confirm_own_guide_assignment(uuid) from public;
revoke all on function public.confirm_own_guide_assignment(uuid) from anon;
grant execute on function public.confirm_own_guide_assignment(uuid) to authenticated;

comment on function public.confirm_own_guide_assignment(uuid) is
  'Confirms only the current pending assignment owned by the authenticated profile guide. Guide identity is derived from auth.uid(); no guide id is accepted.';
