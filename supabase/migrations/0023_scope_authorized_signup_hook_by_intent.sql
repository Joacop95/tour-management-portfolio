-- AUTH-QA-1: scope the Auth signup gate to the activation flow that initiated
-- the request. Browser signup metadata is stored in auth.users raw user
-- metadata and is available to Before User Created as user_metadata.
--
-- This does not replace either post-auth claim function. It prevents a guide
-- allowlist record from being used through /activate, and an internal
-- allowlist record from being used through /guide/register.

create or replace function public.hook_before_user_created_authorized_signup(
  event jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_email text := coalesce(event -> 'user' ->> 'email', '');
  v_normalized_email text;
  v_signup_intent text := coalesce(
    event -> 'user' -> 'user_metadata' ->> 'signup_intent',
    event -> 'user' -> 'raw_user_meta_data' ->> 'signup_intent',
    ''
  );
  v_is_existing_internal_profile boolean := false;
  v_active_internal_authorization_count integer := 0;
  v_claimed_internal_authorization_count integer := 0;
  v_active_guide_email_count integer := 0;
  v_claimed_guide_email_count integer := 0;
begin
  v_normalized_email := lower(btrim(v_auth_email));

  if v_normalized_email = ''
    or v_signup_intent not in ('guide', 'internal') then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'This email is not authorized for this application.'
      )
    );
  end if;

  if v_signup_intent = 'internal' then
    select exists (
      select 1
      from public.profiles as profile
      join public.user_roles as user_role
        on user_role.profile_id = profile.id
      join public.roles as role
        on role.id = user_role.role_id
      where lower(profile.email) = v_normalized_email
        and role.role_key in (
          'super-admin',
          'admin-administrativo',
          'consulta-interna'
        )
    )
    into v_is_existing_internal_profile;

    if v_is_existing_internal_profile then
      return '{}'::jsonb;
    end if;

    select
      count(*),
      count(*) filter (
        where internal_user.status = 'registered'
          or internal_user.profile_id is not null
      )
    into
      v_active_internal_authorization_count,
      v_claimed_internal_authorization_count
    from public.internal_authorized_users as internal_user
    where internal_user.normalized_email = v_normalized_email
      and internal_user.status in ('allowed', 'invited')
      and internal_user.revoked_at is null;

    if v_active_internal_authorization_count = 1
      and v_claimed_internal_authorization_count = 0 then
      return '{}'::jsonb;
    end if;
  end if;

  if v_signup_intent = 'guide' then
    select
      count(*),
      count(*) filter (
        where authorized_email.status = 'registered'
          or authorized_email.profile_id is not null
      )
    into
      v_active_guide_email_count,
      v_claimed_guide_email_count
    from public.guide_authorized_emails as authorized_email
    where authorized_email.normalized_email = v_normalized_email
      and authorized_email.status in ('allowed', 'invited', 'registered')
      and authorized_email.revoked_at is null;

    if v_active_guide_email_count = 1
      and v_claimed_guide_email_count = 0 then
      return '{}'::jsonb;
    end if;
  end if;

  return jsonb_build_object(
    'error',
    jsonb_build_object(
      'http_code', 403,
      'message', 'This email is not authorized for this application.'
    )
  );
end;
$$;

revoke all on function public.hook_before_user_created_authorized_signup(jsonb)
  from public;
revoke all on function public.hook_before_user_created_authorized_signup(jsonb)
  from anon;
revoke all on function public.hook_before_user_created_authorized_signup(jsonb)
  from authenticated;
grant execute on function public.hook_before_user_created_authorized_signup(jsonb)
  to supabase_auth_admin;

comment on function public.hook_before_user_created_authorized_signup(jsonb) is
  'Supabase Auth Before User Created hook. SECURITY DEFINER narrowly checks the browser signup intent against exactly one active, unclaimed guide or internal authorization before Auth user creation. It returns generic errors only and does not link profiles or roles.';
