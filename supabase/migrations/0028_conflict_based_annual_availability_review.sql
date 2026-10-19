-- Annual availability requires Operations review only when a guide-declared
-- unavailable period overlaps an existing current assignment to an active group.

alter table public.guide_availability_submissions
  drop constraint guide_availability_submissions_status_dates_check;

alter table public.guide_availability_submissions
  add constraint guide_availability_submissions_status_dates_check check (
    (status = 'draft' and submitted_at is null and reviewed_at is null)
    or (
      status = 'pending_review'
      and submitted_at is not null
      and reviewed_at is null
      and review_message is null
    )
    or (
      status = 'changes_requested'
      and submitted_at is not null
      and reviewed_at is not null
      and nullif(trim(review_message), '') is not null
    )
    or (
      status = 'approved'
      and submitted_at is not null
      and review_message is null
    )
  );

create or replace function public.save_own_guide_availability_period(
  p_availability_id uuid,
  p_year integer,
  p_start_date date,
  p_end_date date,
  p_status text,
  p_notes text default null
)
returns table (
  success boolean,
  code text,
  message text,
  availability_id uuid,
  submission_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_guide_id uuid;
  v_availability_id uuid;
  v_submission_status public.guide_availability_submission_status;
  v_now timestamptz := now();
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated',
      'Sign in before updating availability.', null::uuid, null::text;
    return;
  end if;

  select p.guide_id
  into v_guide_id
  from public.profiles as p
  where p.id = v_auth_user_id;

  if v_guide_id is null then
    return query select false, 'guide_not_linked',
      'This account is not linked to a guide profile.', null::uuid, null::text;
    return;
  end if;

  if p_year < 2000 or p_year > 2100
    or p_start_date is null
    or p_end_date is null
    or p_end_date < p_start_date
    or extract(year from p_start_date)::integer <> p_year
    or extract(year from p_end_date)::integer <> p_year then
    return query select false, 'invalid_dates',
      'Choose a valid date range within the selected year.', null::uuid, null::text;
    return;
  end if;

  if p_status not in ('available', 'not_available') then
    return query select false, 'invalid_status',
      'Choose Available or Not available.', null::uuid, null::text;
    return;
  end if;

  insert into public.guide_availability_submissions as gas (
    guide_id, year, status, created_at, updated_at
  ) values (
    v_guide_id, p_year, 'draft', v_now, v_now
  ) on conflict (guide_id, year) do nothing;

  select gas.status
  into v_submission_status
  from public.guide_availability_submissions as gas
  where gas.guide_id = v_guide_id
    and gas.year = p_year
  for update;

  if v_submission_status <> 'draft' then
    return query select false, 'submission_locked',
      'Return this submission to draft before editing it.', null::uuid,
      v_submission_status::text;
    return;
  end if;

  if p_availability_id is not null then
    select av.id
    into v_availability_id
    from public.availability as av
    where av.id = p_availability_id
      and av.guide_id = v_guide_id
      and av.source = 'guide_submitted'
      and av.status in ('available', 'not_available')
      and av.assignment_id is null
      and av.is_archived = false
      and extract(year from av.start_date)::integer = p_year
      and extract(year from av.end_date)::integer = p_year
    for update;

    if v_availability_id is null then
      return query select false, 'period_not_editable',
        'This availability period cannot be edited.', null::uuid,
        v_submission_status::text;
      return;
    end if;
  end if;

  if exists (
    select 1
    from public.availability as av
    where av.guide_id = v_guide_id
      and av.is_archived = false
      and (p_availability_id is null or av.id <> p_availability_id)
      and av.start_date <= p_end_date
      and av.end_date >= p_start_date
      and not (
        av.source = 'assignment_generated'
        and av.status = 'occupied_by_assignment'
      )
  ) then
    return query select false, 'period_overlap',
      'This range overlaps another availability period.',
      null::uuid, v_submission_status::text;
    return;
  end if;

  if p_availability_id is null then
    insert into public.availability (
      guide_id, assignment_id, status, source, start_date, end_date, notes,
      created_at, updated_at, updated_by
    ) values (
      v_guide_id, null, p_status::public.availability_status,
      'guide_submitted', p_start_date, p_end_date,
      nullif(trim(p_notes), ''), v_now, v_now, v_auth_user_id
    ) returning id into v_availability_id;
  else
    update public.availability as av
    set status = p_status::public.availability_status,
        start_date = p_start_date,
        end_date = p_end_date,
        notes = nullif(trim(p_notes), ''),
        updated_at = v_now,
        updated_by = v_auth_user_id
    where av.id = p_availability_id
      and av.guide_id = v_guide_id
      and av.source = 'guide_submitted'
      and av.status in ('available', 'not_available')
      and av.assignment_id is null
      and av.is_archived = false
    returning av.id into v_availability_id;

    if v_availability_id is null then
      return query select false, 'period_not_editable',
        'This availability period cannot be edited.', null::uuid,
        v_submission_status::text;
      return;
    end if;
  end if;

  update public.guide_availability_submissions as gas
  set updated_at = v_now
  where gas.guide_id = v_guide_id
    and gas.year = p_year
    and gas.status = 'draft';

  return query select true, 'saved', 'Availability saved.',
    v_availability_id, v_submission_status::text;
end;
$$;

create or replace function public.submit_own_guide_annual_availability(
  p_year integer
)
returns table (
  success boolean,
  code text,
  message text,
  submission_status text,
  submitted_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_guide_id uuid;
  v_now timestamptz := now();
  v_conflict_count integer := 0;
  v_result_status public.guide_availability_submission_status;
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated',
      'Sign in before submitting availability.', null::text, null::timestamptz;
    return;
  end if;

  select p.guide_id
  into v_guide_id
  from public.profiles as p
  where p.id = v_auth_user_id;

  if v_guide_id is null then
    return query select false, 'guide_not_linked',
      'This account is not linked to a guide profile.', null::text, null::timestamptz;
    return;
  end if;

  perform 1
  from public.guide_availability_submissions as gas
  where gas.guide_id = v_guide_id
    and gas.year = p_year
    and gas.status = 'draft'
  for update;

  if not found then
    return query select false, 'submission_not_draft',
      'Only a draft can be submitted.', null::text, null::timestamptz;
    return;
  end if;

  if not exists (
    select 1
    from public.availability as av
    where av.guide_id = v_guide_id
      and av.source = 'guide_submitted'
      and av.status in ('available', 'not_available')
      and av.assignment_id is null
      and av.is_archived = false
      and extract(year from av.start_date)::integer = p_year
      and extract(year from av.end_date)::integer = p_year
  ) then
    return query select false, 'no_periods',
      'Add at least one availability period before submitting.',
      'draft', null::timestamptz;
    return;
  end if;

  -- Serialize this guide's submission decision against assignment inserts or
  -- guide changes, whose foreign-key checks must lock the same guide row.
  perform 1
  from public.guides as gd
  where gd.id = v_guide_id
  for update;

  -- Stabilize assignments that currently qualify for the conflict decision.
  -- These locks are row-scoped; no assignment or group table lock is used.
  perform a.id
  from public.assignments as a
  join public.groups as g on g.id = a.group_id
  where a.guide_id = v_guide_id
    and a.status = 'assigned'
    and a.is_current = true
    and a.is_archived = false
    and g.group_status = 'active'
    and g.is_archived = false
    and g.start_date <= make_date(p_year, 12, 31)
    and g.end_date >= make_date(p_year, 1, 1)
  for share of a, g;

  select count(*)::integer
  into v_conflict_count
  from public.availability as av
  join public.assignments as a
    on a.guide_id = av.guide_id
    and a.status = 'assigned'
    and a.is_current = true
    and a.is_archived = false
  join public.groups as g
    on g.id = a.group_id
    and g.group_status = 'active'
    and g.is_archived = false
  where av.guide_id = v_guide_id
    and av.source = 'guide_submitted'
    and av.status = 'not_available'
    and av.assignment_id is null
    and av.is_archived = false
    and extract(year from av.start_date)::integer = p_year
    and extract(year from av.end_date)::integer = p_year
    and av.start_date <= g.end_date
    and av.end_date >= g.start_date;

  v_result_status := case
    when v_conflict_count > 0 then 'pending_review'
    else 'approved'
  end;

  update public.guide_availability_submissions as gas
  set status = v_result_status,
      submitted_at = v_now,
      reviewed_at = null,
      review_message = null,
      updated_at = v_now
  where gas.guide_id = v_guide_id
    and gas.year = p_year
    and gas.status = 'draft';

  if not found then
    return query select false, 'submission_not_draft',
      'Only a draft can be submitted.', null::text, null::timestamptz;
    return;
  end if;

  if v_conflict_count > 0 then
    return query select true, 'submitted_with_conflicts',
      'Availability requires Operations review because unavailable dates overlap assigned tours.',
      'pending_review', v_now;
    return;
  end if;

  return query select true, 'accepted',
    'Availability submitted and accepted.', 'approved', v_now;
end;
$$;

revoke all on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) from public;
revoke all on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) from anon;
grant execute on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) to authenticated;

revoke all on function public.submit_own_guide_annual_availability(integer) from public;
revoke all on function public.submit_own_guide_annual_availability(integer) from anon;
grant execute on function public.submit_own_guide_annual_availability(integer) to authenticated;

comment on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) is
  'Saves authenticated guide draft availability. Manual periods remain non-overlapping; assignment-generated occupied periods may coexist for conflict reporting.';

comment on function public.submit_own_guide_annual_availability(integer) is
  'Auto-accepts an authenticated guide annual draft unless a guide-submitted unavailable period overlaps that guide current assignment to an active group.';
