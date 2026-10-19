-- Guide-scoped annual availability drafts and submissions.
-- General availability RLS remains unchanged; guide writes are limited to these RPCs.

create type public.guide_availability_submission_status as enum (
  'draft',
  'pending_review',
  'approved'
);

create table public.guide_availability_submissions (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references public.guides(id) on delete cascade,
  year integer not null,
  status public.guide_availability_submission_status not null default 'draft',
  submitted_at timestamptz null,
  reviewed_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint guide_availability_submissions_guide_year_key unique (guide_id, year),
  constraint guide_availability_submissions_year_check check (year between 2000 and 2100),
  constraint guide_availability_submissions_status_dates_check check (
    (status = 'draft' and submitted_at is null and reviewed_at is null)
    or (status = 'pending_review' and submitted_at is not null and reviewed_at is null)
    or (status = 'approved' and submitted_at is not null and reviewed_at is not null)
  )
);

create index guide_availability_submissions_year_status_idx
  on public.guide_availability_submissions (year, status);

alter table public.guide_availability_submissions enable row level security;

create policy "guide_availability_submissions_select_internal_or_own"
on public.guide_availability_submissions
for select
to authenticated
using (
  guide_id = public.current_user_guide_id()
  or public.has_permission('availability.view')
  or public.has_permission('availability.create')
  or public.has_permission('availability.edit')
  or public.has_permission('availability.delete')
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
    guide_id,
    year,
    status,
    created_at,
    updated_at
  )
  values (
    v_guide_id,
    p_year,
    'draft',
    v_now,
    v_now
  )
  on conflict (guide_id, year) do nothing;

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
  ) then
    return query select false, 'period_overlap',
      'This range overlaps existing availability or an occupied assignment.',
      null::uuid, v_submission_status::text;
    return;
  end if;

  if p_availability_id is null then
    insert into public.availability (
      guide_id,
      assignment_id,
      status,
      source,
      start_date,
      end_date,
      notes,
      created_at,
      updated_at,
      updated_by
    )
    values (
      v_guide_id,
      null,
      p_status::public.availability_status,
      'guide_submitted',
      p_start_date,
      p_end_date,
      nullif(trim(p_notes), ''),
      v_now,
      v_now,
      v_auth_user_id
    )
    returning id into v_availability_id;
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

create or replace function public.archive_own_guide_availability_period(
  p_availability_id uuid,
  p_year integer
)
returns table (
  success boolean,
  code text,
  message text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_guide_id uuid;
  v_submission_status public.guide_availability_submission_status;
  v_now timestamptz := now();
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated',
      'Sign in before updating availability.';
    return;
  end if;

  select p.guide_id
  into v_guide_id
  from public.profiles as p
  where p.id = v_auth_user_id;

  if v_guide_id is null then
    return query select false, 'guide_not_linked',
      'This account is not linked to a guide profile.';
    return;
  end if;

  select gas.status
  into v_submission_status
  from public.guide_availability_submissions as gas
  where gas.guide_id = v_guide_id
    and gas.year = p_year
  for update;

  if v_submission_status is null or v_submission_status <> 'draft' then
    return query select false, 'submission_locked',
      'Return this submission to draft before editing it.';
    return;
  end if;

  update public.availability as av
  set is_archived = true,
      archived_at = v_now,
      archived_by = v_auth_user_id,
      archive_reason = 'Archived by guide while editing annual availability.',
      updated_at = v_now,
      updated_by = v_auth_user_id
  where av.id = p_availability_id
    and av.guide_id = v_guide_id
    and av.source = 'guide_submitted'
    and av.status in ('available', 'not_available')
    and av.assignment_id is null
    and av.is_archived = false
    and extract(year from av.start_date)::integer = p_year
    and extract(year from av.end_date)::integer = p_year;

  if not found then
    return query select false, 'period_not_editable',
      'This availability period cannot be deleted.';
    return;
  end if;

  update public.guide_availability_submissions as gas
  set updated_at = v_now
  where gas.guide_id = v_guide_id
    and gas.year = p_year
    and gas.status = 'draft';

  return query select true, 'archived', 'Availability period deleted.';
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
      'Add at least one availability period before submitting.', 'draft', null::timestamptz;
    return;
  end if;

  update public.guide_availability_submissions as gas
  set status = 'pending_review',
      submitted_at = v_now,
      reviewed_at = null,
      updated_at = v_now
  where gas.guide_id = v_guide_id
    and gas.year = p_year
    and gas.status = 'draft';

  if not found then
    return query select false, 'submission_not_draft',
      'Only a draft can be submitted.', null::text, null::timestamptz;
    return;
  end if;

  return query select true, 'submitted', 'Availability submitted for review.',
    'pending_review', v_now;
end;
$$;

create or replace function public.reopen_own_guide_annual_availability(
  p_year integer
)
returns table (
  success boolean,
  code text,
  message text,
  submission_status text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_guide_id uuid;
  v_now timestamptz := now();
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated',
      'Sign in before editing availability.', null::text;
    return;
  end if;

  select p.guide_id
  into v_guide_id
  from public.profiles as p
  where p.id = v_auth_user_id;

  if v_guide_id is null then
    return query select false, 'guide_not_linked',
      'This account is not linked to a guide profile.', null::text;
    return;
  end if;

  update public.guide_availability_submissions as gas
  set status = 'draft',
      submitted_at = null,
      reviewed_at = null,
      updated_at = v_now
  where gas.guide_id = v_guide_id
    and gas.year = p_year
    and gas.status = 'pending_review';

  if not found then
    return query select false, 'submission_not_reopenable',
      'Only a pending submission can return to draft.', null::text;
    return;
  end if;

  return query select true, 'draft', 'Availability returned to draft.', 'draft';
end;
$$;

revoke all on table public.guide_availability_submissions from public;
revoke all on table public.guide_availability_submissions from anon;
grant select on table public.guide_availability_submissions to authenticated;

revoke all on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) from public;
revoke all on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) from anon;
grant execute on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) to authenticated;

revoke all on function public.archive_own_guide_availability_period(uuid, integer) from public;
revoke all on function public.archive_own_guide_availability_period(uuid, integer) from anon;
grant execute on function public.archive_own_guide_availability_period(uuid, integer) to authenticated;

revoke all on function public.submit_own_guide_annual_availability(integer) from public;
revoke all on function public.submit_own_guide_annual_availability(integer) from anon;
grant execute on function public.submit_own_guide_annual_availability(integer) to authenticated;

revoke all on function public.reopen_own_guide_annual_availability(integer) from public;
revoke all on function public.reopen_own_guide_annual_availability(integer) from anon;
grant execute on function public.reopen_own_guide_annual_availability(integer) to authenticated;

comment on table public.guide_availability_submissions is
  'One explicit annual availability draft/submission state per guide and year. Guide writes are available only through own-guide RPCs.';

comment on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) is
  'Creates or updates one non-overlapping guide-submitted availability period for the authenticated guide while the annual submission is a draft.';

comment on function public.archive_own_guide_availability_period(uuid, integer) is
  'Archives only an authenticated guide own guide-submitted draft availability period; assignment-generated and admin rows are excluded.';

comment on function public.submit_own_guide_annual_availability(integer) is
  'Moves the authenticated guide annual availability draft to pending review after at least one explicit period exists.';

comment on function public.reopen_own_guide_annual_availability(integer) is
  'Explicitly returns the authenticated guide pending annual availability submission to draft; approved submissions remain locked.';
