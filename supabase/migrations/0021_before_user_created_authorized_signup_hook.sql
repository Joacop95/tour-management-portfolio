-- GAR-3B: reject unauthorized Auth signups before auth.users is created.
--
-- This hook only gates user creation. The existing
-- claim_authorized_guide_profile() function still links an authorized Auth
-- user to profiles.guide_id and the guide role after authentication succeeds.

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
  v_is_internal_profile boolean := false;
  v_active_guide_email_count integer := 0;
  v_claimed_guide_email_count integer := 0;
begin
  v_normalized_email := lower(btrim(v_auth_email));

  if v_normalized_email = '' then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 403,
        'message', 'This email is not authorized for this application.'
      )
    );
  end if;

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
  into v_is_internal_profile;

  if v_is_internal_profile then
    return '{}'::jsonb;
  end if;

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
  'Supabase Auth Before User Created hook. SECURITY DEFINER is narrowly used to allow active unclaimed guide emails or existing internal profile emails before auth.users exists. It returns only generic authorization errors and does not link profiles or roles.';
