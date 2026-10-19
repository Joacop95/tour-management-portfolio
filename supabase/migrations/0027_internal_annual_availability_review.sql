-- Internal review workflow for guide annual availability submissions.

alter table public.guide_availability_submissions
  add column review_message text null;

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
      and reviewed_at is not null
      and review_message is null
    )
  );

create or replace function public.review_guide_annual_availability(
  p_submission_id uuid,
  p_action text,
  p_review_message text default null
)
returns table (
  success boolean,
  code text,
  message text,
  submission_status text,
  reviewed_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_status public.guide_availability_submission_status;
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated',
      'Sign in before reviewing availability.', null::text, null::timestamptz;
    return;
  end if;

  if not public.has_permission('availability.edit') then
    return query select false, 'permission_denied',
      'You do not have permission to review annual availability.',
      null::text, null::timestamptz;
    return;
  end if;

  if p_action not in ('approve', 'request_changes') then
    return query select false, 'invalid_action',
      'Choose Approve or Request changes.', null::text, null::timestamptz;
    return;
  end if;

  if p_action = 'request_changes'
    and nullif(trim(p_review_message), '') is null then
    return query select false, 'review_message_required',
      'Explain what the guide needs to change.', null::text, null::timestamptz;
    return;
  end if;

  update public.guide_availability_submissions as gas
  set status = case
        when p_action = 'approve'
          then 'approved'::public.guide_availability_submission_status
        else 'changes_requested'::public.guide_availability_submission_status
      end,
      review_message = case
        when p_action = 'request_changes' then trim(p_review_message)
        else null
      end,
      reviewed_at = v_now,
      updated_at = v_now
  where gas.id = p_submission_id
    and gas.status = 'pending_review'
  returning gas.status into v_status;

  if v_status is null then
    return query select false, 'submission_state_changed',
      'This submission is no longer pending review. Refresh and try again.',
      null::text, null::timestamptz;
    return;
  end if;

  return query select true,
    case when p_action = 'approve' then 'approved' else 'changes_requested' end,
    case
      when p_action = 'approve' then 'Annual availability approved.'
      else 'Changes requested from the guide.'
    end,
    v_status::text,
    v_now;
end;
$$;

create or replace function public.begin_own_guide_availability_revision(
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
    and gas.status = 'changes_requested';

  if not found then
    return query select false, 'revision_not_available',
      'This submission is not available for revision.', null::text;
    return;
  end if;

  return query select true, 'draft',
    'Availability is ready to edit.', 'draft';
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
      'Add at least one availability period before submitting.',
      'draft', null::timestamptz;
    return;
  end if;

  update public.guide_availability_submissions as gas
  set status = 'pending_review',
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

  return query select true, 'submitted',
    'Availability submitted for review.', 'pending_review', v_now;
end;
$$;

revoke all on function public.review_guide_annual_availability(uuid, text, text) from public;
revoke all on function public.review_guide_annual_availability(uuid, text, text) from anon;
grant execute on function public.review_guide_annual_availability(uuid, text, text) to authenticated;

revoke all on function public.begin_own_guide_availability_revision(integer) from public;
revoke all on function public.begin_own_guide_availability_revision(integer) from anon;
grant execute on function public.begin_own_guide_availability_revision(integer) to authenticated;

-- Pending submissions remain with Operations until reviewed. Guides may only
-- reopen after an explicit changes-requested decision through the RPC above.
revoke execute on function public.reopen_own_guide_annual_availability(integer) from authenticated;

comment on function public.review_guide_annual_availability(uuid, text, text) is
  'Allows only authenticated availability.edit users to approve or request changes on a currently pending annual submission.';

comment on function public.begin_own_guide_availability_revision(integer) is
  'Returns only the authenticated guide own changes-requested annual submission to draft while retaining the guide-visible review message.';
