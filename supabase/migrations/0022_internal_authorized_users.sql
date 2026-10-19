-- IUR-1: internal authorized users foundation.
--
-- This migration creates a private authorization registry for internal roles,
-- extends the existing Auth Before User Created hook, and adds the post-auth
-- claim RPC. It does not create Auth users or expose any anonymous allowlist.

create table public.internal_authorized_users (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  normalized_email text generated always as (lower(btrim(email))) stored,
  role_id uuid not null references public.roles(id),
  status text not null default 'allowed',
  profile_id uuid null references public.profiles(id) on delete set null,
  notes text null,
  invited_at timestamptz null,
  registered_at timestamptz null,
  revoked_at timestamptz null,
  created_by_profile_id uuid null references public.profiles(id) on delete set null,
  updated_by_profile_id uuid null references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint internal_authorized_users_email_not_blank_check
    check (btrim(email) <> ''),
  constraint internal_authorized_users_status_check
    check (status in ('allowed', 'invited', 'registered', 'revoked')),
  constraint internal_authorized_users_registered_profile_check
    check (status <> 'registered' or profile_id is not null),
  constraint internal_authorized_users_revoked_timestamp_check
    check (status <> 'revoked' or revoked_at is not null)
);

create unique index internal_authorized_users_active_normalized_email_key
  on public.internal_authorized_users (normalized_email)
  where status <> 'revoked';

create index internal_authorized_users_normalized_email_idx
  on public.internal_authorized_users (normalized_email);

create index internal_authorized_users_role_id_idx
  on public.internal_authorized_users (role_id);

create index internal_authorized_users_status_idx
  on public.internal_authorized_users (status);

create index internal_authorized_users_profile_id_idx
  on public.internal_authorized_users (profile_id);

create or replace function public.validate_internal_authorized_user_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1
    from public.roles as role
    where role.id = new.role_id
      and role.role_key in (
        'super-admin',
        'admin-administrativo',
        'consulta-interna'
      )
  ) then
    raise exception 'internal_authorized_users role_id must reference an internal role';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_internal_authorized_user_role() from public;
revoke all on function public.validate_internal_authorized_user_role() from anon;
revoke all on function public.validate_internal_authorized_user_role() from authenticated;

create trigger internal_authorized_users_validate_role
before insert or update of role_id
on public.internal_authorized_users
for each row
execute function public.validate_internal_authorized_user_role();

insert into public.internal_authorized_users (
  email,
  role_id,
  status,
  profile_id,
  notes,
  registered_at,
  created_at,
  updated_at
)
select distinct on (profile.id)
  profile.email,
  role.id,
  'registered',
  profile.id,
  'Backfilled from an existing internal profile and role mapping.',
  now(),
  now(),
  now()
from public.profiles as profile
join public.user_roles as user_role
  on user_role.profile_id = profile.id
join public.roles as role
  on role.id = user_role.role_id
where role.role_key in (
  'super-admin',
  'admin-administrativo',
  'consulta-interna'
)
order by
  profile.id,
  case role.role_key
    when 'super-admin' then 1
    when 'admin-administrativo' then 2
    else 3
  end
on conflict (normalized_email) where status <> 'revoked'
do nothing;

alter table public.internal_authorized_users enable row level security;

revoke all on public.internal_authorized_users from anon;
grant select, insert, update on public.internal_authorized_users to authenticated;

-- The existing role model grants settings.manage_roles_permissions to Super
-- Admin only. Admin Administrativo management is intentionally deferred to
-- IUR-2 rather than broadening role-management permissions in this foundation.
create policy "internal_authorized_users_select_security_admin"
on public.internal_authorized_users
for select
to authenticated
using (public.has_permission('settings.manage_roles_permissions'));

create policy "internal_authorized_users_insert_security_admin"
on public.internal_authorized_users
for insert
to authenticated
with check (public.has_permission('settings.manage_roles_permissions'));

create policy "internal_authorized_users_update_security_admin"
on public.internal_authorized_users
for update
to authenticated
using (public.has_permission('settings.manage_roles_permissions'))
with check (public.has_permission('settings.manage_roles_permissions'));

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
  v_is_existing_internal_profile boolean := false;
  v_active_internal_authorization_count integer := 0;
  v_claimed_internal_authorization_count integer := 0;
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

create or replace function public.claim_authorized_internal_profile()
returns table(
  success boolean,
  code text,
  message text,
  profile_id uuid,
  role_key text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_auth_user_id uuid := auth.uid();
  v_auth_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_normalized_email text := lower(btrim(coalesce(auth.jwt() ->> 'email', '')));
  v_authorization_match_count integer := 0;
  v_authorization_id uuid;
  v_authorization_role_id uuid;
  v_authorization_profile_id uuid;
  v_authorization_status text;
  v_role_key text;
  v_profile_id uuid;
  v_profile_exists boolean := false;
begin
  if v_auth_user_id is null then
    return query select false, 'not_authenticated', 'A signed-in user is required.', null::uuid, null::text;
    return;
  end if;

  if v_auth_email = '' then
    return query select false, 'missing_auth_email', 'The signed-in user does not have an email address.', null::uuid, null::text;
    return;
  end if;

  select count(*)
  into v_authorization_match_count
  from public.internal_authorized_users as internal_user
  where internal_user.normalized_email = v_normalized_email
    and internal_user.status in ('allowed', 'invited', 'registered')
    and internal_user.revoked_at is null;

  if v_authorization_match_count <> 1 then
    return query select false, 'email_not_authorized', 'This email is not authorized for internal access.', null::uuid, null::text;
    return;
  end if;

  select
    internal_user.id,
    internal_user.role_id,
    internal_user.profile_id,
    internal_user.status,
    role.role_key
  into
    v_authorization_id,
    v_authorization_role_id,
    v_authorization_profile_id,
    v_authorization_status,
    v_role_key
  from public.internal_authorized_users as internal_user
  join public.roles as role
    on role.id = internal_user.role_id
  where internal_user.normalized_email = v_normalized_email
    and internal_user.status in ('allowed', 'invited', 'registered')
    and internal_user.revoked_at is null
  limit 1
  for update of internal_user;

  if v_authorization_status = 'registered'
    and v_authorization_profile_id is distinct from v_auth_user_id then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::text;
    return;
  end if;

  if v_authorization_status in ('allowed', 'invited')
    and v_authorization_profile_id is not null
    and v_authorization_profile_id <> v_auth_user_id then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::text;
    return;
  end if;

  if v_role_key not in (
    'super-admin',
    'admin-administrativo',
    'consulta-interna'
  ) then
    return query select false, 'invalid_internal_role', 'This email is not authorized for internal access.', null::uuid, null::text;
    return;
  end if;

  select profile.id
  into v_profile_id
  from public.profiles as profile
  where profile.id = v_auth_user_id;

  v_profile_exists := found;

  if exists (
    select 1
    from public.profiles as existing_profile
    where lower(existing_profile.email) = v_normalized_email
      and existing_profile.id <> v_auth_user_id
  ) then
    return query select false, 'email_already_claimed', 'This email is already linked to another profile.', null::uuid, null::text;
    return;
  end if;

  if v_profile_exists then
    update public.profiles as profile
    set
      email = v_auth_email,
      updated_at = now()
    where profile.id = v_auth_user_id;
  else
    insert into public.profiles (
      id,
      email,
      created_at,
      updated_at
    )
    values (
      v_auth_user_id,
      v_auth_email,
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
    v_authorization_role_id,
    now(),
    now()
  )
  on conflict on constraint user_roles_profile_role_key do nothing;

  update public.internal_authorized_users as internal_user
  set
    profile_id = v_auth_user_id,
    status = 'registered',
    registered_at = coalesce(internal_user.registered_at, now()),
    updated_at = now()
  where internal_user.id = v_authorization_id;

  return query select true, 'claimed', 'Internal profile access is ready.', v_auth_user_id, v_role_key;
end;
$$;

revoke all on function public.claim_authorized_internal_profile() from public;
revoke all on function public.claim_authorized_internal_profile() from anon;
grant execute on function public.claim_authorized_internal_profile() to authenticated;

comment on table public.internal_authorized_users is
  'Private internal Auth authorization registry. RLS allows only security administrators to manage records; no delete policy exists.';

comment on function public.hook_before_user_created_authorized_signup(jsonb) is
  'Supabase Auth Before User Created hook. SECURITY DEFINER is narrowly used to allow one active unclaimed guide or internal authorization, or an existing internal profile, before Auth user creation. It returns only generic authorization errors and does not link profiles or roles.';

comment on function public.claim_authorized_internal_profile() is
  'Claims an already-authorized internal email for auth.uid(). SECURITY DEFINER is limited to creating/linking the caller profile, adding the authorized internal role, and marking the authorization registered. It does not expose an anonymous allowlist lookup.';
