-- GAR-1 follow-up: avoid PL/pgSQL output-column ambiguity in the authorized
-- guide profile claim function. RETURNS TABLE output names are PL/pgSQL
-- variables, so every table read is alias-qualified and function state uses
-- v_* variables.

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
  v_auth_user_id uuid := auth.uid();
  v_auth_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_normalized_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_authorized_email_match_count integer := 0;
  v_authorized_email_id uuid;
  v_authorized_email_profile_id uuid;
  v_authorized_email_status text;
  v_guide_id uuid;
  v_profile_id uuid;
  v_profile_guide_id uuid;
  v_profile_full_name text;
  v_profile_preferred_language public.supported_language;
  v_profile_exists boolean := false;
  v_has_internal_role boolean := false;
  v_guide_role_id uuid;
  v_guide_full_name text;
  v_guide_preferred_language public.supported_language;
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated', 'A signed-in user is required.', null::uuid, null::uuid;
    return;
  end if;

  if v_auth_email = '' then
    return query select false, 'missing_auth_email', 'The signed-in user does not have an email address.', null::uuid, null::uuid;
    return;
  end if;

  select count(*)
  into v_authorized_email_match_count
  from public.guide_authorized_emails as authorized_email
  where authorized_email.normalized_email = v_normalized_email
    and authorized_email.status in ('allowed', 'invited', 'registered');

  if v_authorized_email_match_count <> 1 then
    return query select false, 'email_not_authorized', 'This email is not eligible for Guide Portal access.', null::uuid, null::uuid;
    return;
  end if;

  select
    authorized_email.id,
    authorized_email.guide_id,
    authorized_email.profile_id,
    authorized_email.status
  into
    v_authorized_email_id,
    v_guide_id,
    v_authorized_email_profile_id,
    v_authorized_email_status
  from public.guide_authorized_emails as authorized_email
  where authorized_email.normalized_email = v_normalized_email
    and authorized_email.status in ('allowed', 'invited', 'registered')
  limit 1
  for update;

  if v_authorized_email_status = 'registered'
    and v_authorized_email_profile_id is distinct from v_auth_user_id then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::uuid;
    return;
  end if;

  if v_authorized_email_status in ('allowed', 'invited')
    and v_authorized_email_profile_id is not null
    and v_authorized_email_profile_id <> v_auth_user_id then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::uuid;
    return;
  end if;

  select
    profile.id,
    profile.guide_id,
    profile.full_name,
    profile.preferred_language
  into
    v_profile_id,
    v_profile_guide_id,
    v_profile_full_name,
    v_profile_preferred_language
  from public.profiles as profile
  where profile.id = v_auth_user_id;

  v_profile_exists := found;

  if exists (
    select 1
    from public.profiles as existing_profile
    where lower(existing_profile.email) = v_normalized_email
      and existing_profile.id <> v_auth_user_id
  ) then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::uuid;
    return;
  end if;

  if v_profile_exists then
    select exists (
      select 1
      from public.user_roles as user_role
      join public.roles as role on role.id = user_role.role_id
      where user_role.profile_id = v_auth_user_id
        and role.role_key <> 'guide'
    )
    into v_has_internal_role;

    if v_has_internal_role then
      return query select false, 'internal_profile_not_eligible', 'Internal or administrative profiles cannot claim Guide Portal access.', null::uuid, v_profile_id;
      return;
    end if;

    if v_profile_guide_id is not null
      and v_profile_guide_id <> v_guide_id then
      return query select false, 'profile_linked_to_other_guide', 'This profile is already linked to another guide.', null::uuid, v_profile_id;
      return;
    end if;
  end if;

  select role.id
  into v_guide_role_id
  from public.roles as role
  where role.role_key = 'guide';

  if v_guide_role_id is null then
    return query select false, 'guide_role_missing', 'Guide access is not configured.', null::uuid, null::uuid;
    return;
  end if;

  select
    guide.full_name,
    guide.preferred_language
  into
    v_guide_full_name,
    v_guide_preferred_language
  from public.guides as guide
  where guide.id = v_guide_id
    and guide.is_archived = false;

  if not found then
    return query select false, 'guide_not_available', 'The authorized guide is not available.', null::uuid, null::uuid;
    return;
  end if;

  if v_profile_exists then
    update public.profiles as profile
    set
      email = v_auth_email,
      full_name = coalesce(v_profile_full_name, v_guide_full_name),
      guide_id = v_guide_id,
      preferred_language = coalesce(v_profile_preferred_language, v_guide_preferred_language),
      updated_at = now()
    where profile.id = v_auth_user_id;
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
      v_auth_user_id,
      v_auth_email,
      v_guide_full_name,
      v_guide_id,
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
    v_auth_user_id,
    v_guide_role_id,
    now(),
    now()
  )
  on conflict on constraint user_roles_profile_role_key do nothing;

  update public.guide_authorized_emails as authorized_email
  set
    profile_id = v_auth_user_id,
    status = 'registered',
    registered_at = coalesce(authorized_email.registered_at, now()),
    updated_at = now()
  where authorized_email.id = v_authorized_email_id;

  return query select true, 'claimed', 'Guide Portal profile access is ready.', v_guide_id, v_auth_user_id;
end;
$$;

revoke all on function public.claim_authorized_guide_profile() from public;
revoke all on function public.claim_authorized_guide_profile() from anon;
grant execute on function public.claim_authorized_guide_profile() to authenticated;

comment on function public.claim_authorized_guide_profile() is
  'Claims an already-authorized guide email for auth.uid(). SECURITY DEFINER is intentionally limited to profile, guide role, and allowlist linking because unlinked guides cannot read guide_authorized_emails through RLS. Migration 0020 alias-qualifies table columns to avoid RETURNS TABLE output-name ambiguity.';
