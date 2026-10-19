-- GAR-1: Authorized Guide Profile Claim foundation.
--
-- This function links an authenticated Auth user to an already-authorized
-- guide. It does not create Auth users, expose the allowlist, or implement a
-- registration UI.

create or replace function public.claim_authorized_guide_profile()
returns table(
  success boolean,
  code text,
  message text,
  guide_id uuid,
  profile_id uuid
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_auth_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_authorized_email public.guide_authorized_emails%rowtype;
  v_match_count integer := 0;
  v_profile public.profiles%rowtype;
  v_profile_exists boolean := false;
  v_has_internal_role boolean := false;
  v_guide_role_id uuid;
  v_guide_full_name text;
  v_guide_preferred_language public.supported_language;
begin
  if v_user_id is null then
    return query select false, 'not_authenticated', 'A signed-in user is required.', null::uuid, null::uuid;
    return;
  end if;

  if v_auth_email = '' then
    return query select false, 'missing_auth_email', 'The signed-in user does not have an email address.', null::uuid, null::uuid;
    return;
  end if;

  select count(*)
  into v_match_count
  from public.guide_authorized_emails
  where normalized_email = v_auth_email
    and status in ('allowed', 'invited', 'registered');

  if v_match_count <> 1 then
    return query select false, 'email_not_authorized', 'This email is not eligible for Guide Portal access.', null::uuid, null::uuid;
    return;
  end if;

  select *
  into v_authorized_email
  from public.guide_authorized_emails
  where normalized_email = v_auth_email
    and status in ('allowed', 'invited', 'registered')
  limit 1
  for update;

  if v_authorized_email.status = 'registered'
    and v_authorized_email.profile_id is distinct from v_user_id then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::uuid;
    return;
  end if;

  if v_authorized_email.status in ('allowed', 'invited')
    and v_authorized_email.profile_id is not null
    and v_authorized_email.profile_id <> v_user_id then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::uuid;
    return;
  end if;

  select *
  into v_profile
  from public.profiles
  where id = v_user_id;

  v_profile_exists := found;

  if exists (
    select 1
    from public.profiles
    where lower(email) = v_auth_email
      and id <> v_user_id
  ) then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::uuid;
    return;
  end if;

  if v_profile_exists then
    select exists (
      select 1
      from public.user_roles
      join public.roles on roles.id = user_roles.role_id
      where user_roles.profile_id = v_user_id
        and roles.role_key <> 'guide'
    )
    into v_has_internal_role;

    if v_has_internal_role then
      return query select false, 'internal_profile_not_eligible', 'Internal or administrative profiles cannot claim Guide Portal access.', null::uuid, v_user_id;
      return;
    end if;

    if v_profile.guide_id is not null
      and v_profile.guide_id <> v_authorized_email.guide_id then
      return query select false, 'profile_linked_to_other_guide', 'This profile is already linked to another guide.', null::uuid, v_user_id;
      return;
    end if;
  end if;

  select id
  into v_guide_role_id
  from public.roles
  where role_key = 'guide';

  if v_guide_role_id is null then
    return query select false, 'guide_role_missing', 'Guide access is not configured.', null::uuid, null::uuid;
    return;
  end if;

  select full_name, preferred_language
  into v_guide_full_name, v_guide_preferred_language
  from public.guides
  where id = v_authorized_email.guide_id
    and is_archived = false;

  if not found then
    return query select false, 'guide_not_available', 'The authorized guide is not available.', null::uuid, null::uuid;
    return;
  end if;

  if v_profile_exists then
    update public.profiles
    set
      email = v_auth_email,
      full_name = coalesce(v_profile.full_name, v_guide_full_name),
      guide_id = v_authorized_email.guide_id,
      preferred_language = coalesce(v_profile.preferred_language, v_guide_preferred_language),
      updated_at = now()
    where id = v_user_id;
  else
    insert into public.profiles (
      id,
      email,
      full_name,
      guide_id,
      preferred_language,
      created_at,
      updated_at
    )
    values (
      v_user_id,
      v_auth_email,
      v_guide_full_name,
      v_authorized_email.guide_id,
      v_guide_preferred_language,
      now(),
      now()
    );
  end if;

  insert into public.user_roles (
    profile_id,
    role_id,
    created_at,
    updated_at
  )
  values (
    v_user_id,
    v_guide_role_id,
    now(),
    now()
  )
  on conflict (profile_id, role_id) do nothing;

  update public.guide_authorized_emails
  set
    profile_id = v_user_id,
    status = 'registered',
    registered_at = coalesce(registered_at, now()),
    updated_at = now()
  where id = v_authorized_email.id;

  return query select true, 'claimed', 'Guide Portal profile access is ready.', v_authorized_email.guide_id, v_user_id;
end;
$$;

revoke all on function public.claim_authorized_guide_profile() from public;
revoke all on function public.claim_authorized_guide_profile() from anon;
grant execute on function public.claim_authorized_guide_profile() to authenticated;

comment on function public.claim_authorized_guide_profile() is
  'Claims an already-authorized guide email for auth.uid(). SECURITY DEFINER is intentionally limited to profile, guide role, and allowlist linking because unlinked guides cannot read guide_authorized_emails through RLS.';
