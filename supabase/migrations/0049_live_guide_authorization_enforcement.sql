-- Guide Portal authority follows the canonical guide_authorized_emails state.
-- A linked profile remains useful for history and future reauthorization, but
-- a revoked authorization cannot resolve Guide data or invoke own-Guide RPCs.

create or replace function public.current_user_guide_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select profile.guide_id
  from public.profiles as profile
  where profile.id = auth.uid()
    and profile.guide_id is not null
    and exists (
      select 1
      from public.guide_authorized_emails as authz
      where authz.profile_id = profile.id
        and authz.guide_id = profile.guide_id
        and authz.normalized_email = lower(btrim(profile.email))
        and authz.status in ('allowed', 'invited', 'registered')
        and authz.revoked_at is null
    )
  limit 1;
$$;

revoke all on function public.current_user_guide_id() from public, anon;
grant execute on function public.current_user_guide_id() to authenticated;

create function public.sync_guide_portal_role_for_profile(
  p_profile_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_guide_role_id uuid;
  v_has_active_authorization boolean;
begin
  if p_profile_id is null then
    return;
  end if;

  select role.id
  into v_guide_role_id
  from public.roles as role
  where role.role_key = 'guide';

  if v_guide_role_id is null then
    raise exception using
      errcode = 'P0001',
      message = 'Guide role is not configured.';
  end if;

  select exists (
    select 1
    from public.profiles as profile
    join public.guide_authorized_emails as authz
      on authz.profile_id = profile.id
      and authz.guide_id = profile.guide_id
      and authz.normalized_email = lower(btrim(profile.email))
    where profile.id = p_profile_id
      and profile.guide_id is not null
      and authz.status in ('allowed', 'invited', 'registered')
      and authz.revoked_at is null
  )
  into v_has_active_authorization;

  if v_has_active_authorization then
    insert into public.user_roles (
      profile_id,
      role_id,
      updated_by
    )
    values (
      p_profile_id,
      v_guide_role_id,
      auth.uid()
    )
    on conflict on constraint user_roles_profile_role_key
    do update set
      updated_at = clock_timestamp(),
      updated_by = excluded.updated_by;
  else
    delete from public.user_roles as user_role
    where user_role.profile_id = p_profile_id
      and user_role.role_id = v_guide_role_id;
  end if;
end;
$$;

revoke all on function public.sync_guide_portal_role_for_profile(uuid)
  from public, anon, authenticated;

create function public.sync_guide_portal_role_from_authorization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE')
    and old.profile_id is not null
    and (tg_op = 'DELETE' or old.profile_id is distinct from new.profile_id) then
    perform public.sync_guide_portal_role_for_profile(old.profile_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.profile_id is not null then
    perform public.sync_guide_portal_role_for_profile(new.profile_id);
  end if;

  return coalesce(new, old);
end;
$$;

revoke all on function public.sync_guide_portal_role_from_authorization()
  from public, anon, authenticated;

drop trigger if exists guide_authorization_sync_portal_role
  on public.guide_authorized_emails;
create trigger guide_authorization_sync_portal_role
after insert or update or delete on public.guide_authorized_emails
for each row execute function public.sync_guide_portal_role_from_authorization();

create function public.sync_guide_portal_role_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.sync_guide_portal_role_for_profile(new.id);
  return new;
end;
$$;

revoke all on function public.sync_guide_portal_role_from_profile()
  from public, anon, authenticated;

drop trigger if exists profile_sync_guide_portal_role on public.profiles;
create trigger profile_sync_guide_portal_role
after insert or update of email, guide_id on public.profiles
for each row execute function public.sync_guide_portal_role_from_profile();

do $$
declare
  profile_row record;
begin
  for profile_row in
    select profile.id
    from public.profiles as profile
    where profile.guide_id is not null
  loop
    perform public.sync_guide_portal_role_for_profile(profile_row.id);
  end loop;
end;
$$;

-- Keep the existing claim body for new claims. The public wrapper adds an
-- idempotent path for already-linked dual Guide/internal identities.
alter function public.claim_authorized_guide_profile()
  rename to claim_authorized_guide_profile_body_v0049;
revoke all on function public.claim_authorized_guide_profile_body_v0049()
  from public, anon, authenticated;

create function public.claim_authorized_guide_profile()
returns table(
  success boolean,
  code text,
  message text,
  guide_id uuid,
  profile_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_auth_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_guide_id uuid;
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated',
      'A signed-in user is required.', null::uuid, null::uuid;
    return;
  end if;

  select profile.guide_id
  into v_guide_id
  from public.profiles as profile
  join public.guide_authorized_emails as authz
    on authz.profile_id = profile.id
    and authz.guide_id = profile.guide_id
    and authz.normalized_email = lower(btrim(profile.email))
  where profile.id = v_auth_user_id
    and authz.normalized_email = v_auth_email
    and authz.status in ('allowed', 'invited', 'registered')
    and authz.revoked_at is null
  limit 1;

  if v_guide_id is not null then
    perform public.sync_guide_portal_role_for_profile(v_auth_user_id);
    return query select true, 'already_claimed',
      'Guide Portal profile access is ready.', v_guide_id, v_auth_user_id;
    return;
  end if;

  return query
  select result.success, result.code, result.message,
    result.guide_id, result.profile_id
  from public.claim_authorized_guide_profile_body_v0049() as result;
end;
$$;

revoke all on function public.claim_authorized_guide_profile()
  from public, anon;
grant execute on function public.claim_authorized_guide_profile()
  to authenticated;

-- The legacy own-Guide RPC bodies predate authorization revocation and derive
-- profiles.guide_id directly. Rename and hide them, then expose guarded wrappers
-- with the original signatures so every next call checks current authority.

alter function public.confirm_own_guide_assignment(uuid)
  rename to confirm_own_guide_assignment_body_v0049;
revoke all on function public.confirm_own_guide_assignment_body_v0049(uuid)
  from public, anon, authenticated;

create function public.confirm_own_guide_assignment(p_assignment_id uuid)
returns table(
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
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated',
      'Sign in before confirming an assignment.', null::uuid, null::uuid;
    return;
  end if;

  if public.current_user_guide_id() is null then
    return query select false, 'guide_access_denied',
      'Guide Portal access is unavailable.', null::uuid, null::uuid;
    return;
  end if;

  return query
  select result.success, result.code, result.message,
    result.assignment_id, result.group_id
  from public.confirm_own_guide_assignment_body_v0049(p_assignment_id) as result;
end;
$$;

alter function public.save_own_guide_availability_period(uuid, integer, date, date, text, text)
  rename to save_own_guide_availability_period_body_v0049;
revoke all on function public.save_own_guide_availability_period_body_v0049(uuid, integer, date, date, text, text)
  from public, anon, authenticated;

create function public.save_own_guide_availability_period(
  p_availability_id uuid,
  p_year integer,
  p_start_date date,
  p_end_date date,
  p_status text,
  p_notes text default null
)
returns table(
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
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated',
      'Sign in before updating availability.', null::uuid, null::text;
    return;
  end if;
  if public.current_user_guide_id() is null then
    return query select false, 'guide_access_denied',
      'Guide Portal access is unavailable.', null::uuid, null::text;
    return;
  end if;

  return query
  select result.success, result.code, result.message,
    result.availability_id, result.submission_status
  from public.save_own_guide_availability_period_body_v0049(
    p_availability_id, p_year, p_start_date, p_end_date, p_status, p_notes
  ) as result;
end;
$$;

alter function public.archive_own_guide_availability_period(uuid, integer)
  rename to archive_own_guide_availability_period_body_v0049;
revoke all on function public.archive_own_guide_availability_period_body_v0049(uuid, integer)
  from public, anon, authenticated;

create function public.archive_own_guide_availability_period(
  p_availability_id uuid,
  p_year integer
)
returns table(success boolean, code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated',
      'Sign in before updating availability.';
    return;
  end if;
  if public.current_user_guide_id() is null then
    return query select false, 'guide_access_denied',
      'Guide Portal access is unavailable.';
    return;
  end if;

  return query
  select result.success, result.code, result.message
  from public.archive_own_guide_availability_period_body_v0049(
    p_availability_id, p_year
  ) as result;
end;
$$;

alter function public.submit_own_guide_annual_availability(integer)
  rename to submit_own_guide_annual_availability_body_v0049;
revoke all on function public.submit_own_guide_annual_availability_body_v0049(integer)
  from public, anon, authenticated;

create function public.submit_own_guide_annual_availability(p_year integer)
returns table(
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
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated',
      'Sign in before submitting availability.', null::text, null::timestamptz;
    return;
  end if;
  if public.current_user_guide_id() is null then
    return query select false, 'guide_access_denied',
      'Guide Portal access is unavailable.', null::text, null::timestamptz;
    return;
  end if;

  return query
  select result.success, result.code, result.message,
    result.submission_status, result.submitted_at
  from public.submit_own_guide_annual_availability_body_v0049(p_year) as result;
end;
$$;

alter function public.reopen_own_guide_annual_availability(integer)
  rename to reopen_own_guide_annual_availability_body_v0049;
revoke all on function public.reopen_own_guide_annual_availability_body_v0049(integer)
  from public, anon, authenticated;

create function public.reopen_own_guide_annual_availability(p_year integer)
returns table(success boolean, code text, message text, submission_status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated',
      'Sign in before editing availability.', null::text;
    return;
  end if;
  if public.current_user_guide_id() is null then
    return query select false, 'guide_access_denied',
      'Guide Portal access is unavailable.', null::text;
    return;
  end if;

  return query
  select result.success, result.code, result.message, result.submission_status
  from public.reopen_own_guide_annual_availability_body_v0049(p_year) as result;
end;
$$;

alter function public.begin_own_guide_availability_revision(integer)
  rename to begin_own_guide_availability_revision_body_v0049;
revoke all on function public.begin_own_guide_availability_revision_body_v0049(integer)
  from public, anon, authenticated;

create function public.begin_own_guide_availability_revision(p_year integer)
returns table(success boolean, code text, message text, submission_status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated',
      'Sign in before editing availability.', null::text;
    return;
  end if;
  if public.current_user_guide_id() is null then
    return query select false, 'guide_access_denied',
      'Guide Portal access is unavailable.', null::text;
    return;
  end if;

  return query
  select result.success, result.code, result.message, result.submission_status
  from public.begin_own_guide_availability_revision_body_v0049(p_year) as result;
end;
$$;

alter function public.begin_own_auto_accepted_availability_revision(integer)
  rename to begin_own_auto_accepted_availability_revision_body_v0049;
revoke all on function public.begin_own_auto_accepted_availability_revision_body_v0049(integer)
  from public, anon, authenticated;

create function public.begin_own_auto_accepted_availability_revision(p_year integer)
returns table(success boolean, code text, message text, submission_status text)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return query select false, 'not_authenticated',
      'Sign in before editing availability.', null::text;
    return;
  end if;
  if public.current_user_guide_id() is null then
    return query select false, 'guide_access_denied',
      'Guide Portal access is unavailable.', null::text;
    return;
  end if;

  return query
  select result.success, result.code, result.message, result.submission_status
  from public.begin_own_auto_accepted_availability_revision_body_v0049(p_year) as result;
end;
$$;

revoke all on function public.confirm_own_guide_assignment(uuid) from public, anon;
revoke all on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) from public, anon;
revoke all on function public.archive_own_guide_availability_period(uuid, integer) from public, anon;
revoke all on function public.submit_own_guide_annual_availability(integer) from public, anon;
revoke all on function public.reopen_own_guide_annual_availability(integer) from public, anon;
revoke all on function public.begin_own_guide_availability_revision(integer) from public, anon;
revoke all on function public.begin_own_auto_accepted_availability_revision(integer) from public, anon;

grant execute on function public.confirm_own_guide_assignment(uuid) to authenticated;
grant execute on function public.save_own_guide_availability_period(uuid, integer, date, date, text, text) to authenticated;
grant execute on function public.archive_own_guide_availability_period(uuid, integer) to authenticated;
grant execute on function public.submit_own_guide_annual_availability(integer) to authenticated;
grant execute on function public.reopen_own_guide_annual_availability(integer) to authenticated;
grant execute on function public.begin_own_guide_availability_revision(integer) to authenticated;
grant execute on function public.begin_own_auto_accepted_availability_revision(integer) to authenticated;

comment on function public.current_user_guide_id() is
  'Returns the authenticated profile linked guide only while a matching canonical Guide authorization is active.';
comment on function public.sync_guide_portal_role_for_profile(uuid) is
  'Synchronizes only the Guide role from canonical Guide authorization; internal roles are never changed.';
comment on function public.claim_authorized_guide_profile() is
  'Claims new Guide authorization or idempotently restores an already-linked active Guide identity, including dual internal/Guide users.';
