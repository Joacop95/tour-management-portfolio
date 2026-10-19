-- Internal user authorization and access-level administration.
--
-- Browser writes are routed through permission-checked SECURITY DEFINER RPCs.
-- Internal role changes preserve Guide role bindings and serialize the
-- last-Super-Admin safety check on the protected Super Admin role row.

drop policy if exists "internal_authorized_users_insert_security_admin"
  on public.internal_authorized_users;
drop policy if exists "internal_authorized_users_update_security_admin"
  on public.internal_authorized_users;
revoke insert, update, delete on table public.internal_authorized_users
  from public, anon, authenticated;

-- Historical revocation only changed the registry row. Remove stale internal
-- grants for profiles that have no active internal authorization, while
-- preserving Guide and any other non-internal role bindings.
delete from public.user_roles as user_role
using public.roles as role
where user_role.role_id = role.id
  and role.role_key in (
    'super-admin',
    'admin-administrativo',
    'consulta-interna'
  )
  and exists (
    select 1
    from public.internal_authorized_users as revoked_authorization
    where revoked_authorization.profile_id = user_role.profile_id
      and revoked_authorization.status = 'revoked'
  )
  and not exists (
    select 1
    from public.internal_authorized_users as active_authorization
    where active_authorization.profile_id = user_role.profile_id
      and active_authorization.status in ('allowed', 'invited', 'registered')
      and active_authorization.revoked_at is null
  );

create function public.create_internal_authorized_user(
  p_email text,
  p_role_id uuid,
  p_status text default 'allowed',
  p_notes text default null
)
returns table(success boolean, code text, message text, authorization_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_role_key text;
  v_authorization_id uuid;
begin
  if v_actor_id is null
    or not public.has_permission('settings.manage_roles_permissions') then
    return query select false, 'not_authorized',
      'You do not have permission to manage internal users.', null::uuid;
    return;
  end if;

  if v_email = ''
    or v_email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    return query select false, 'invalid_email',
      'Enter a valid email address.', null::uuid;
    return;
  end if;

  if p_status not in ('allowed', 'invited') then
    return query select false, 'invalid_status',
      'Choose a valid authorization status.', null::uuid;
    return;
  end if;

  select role.role_key
  into v_role_key
  from public.roles as role
  where role.id = p_role_id
    and role.role_key in (
      'super-admin',
      'admin-administrativo',
      'consulta-interna'
    )
  for update;

  if v_role_key is null then
    return query select false, 'invalid_internal_role',
      'Choose a valid internal role.', null::uuid;
    return;
  end if;

  if v_role_key = 'super-admin' and not exists (
    select 1
    from public.user_roles as actor_user_role
    join public.roles as actor_role on actor_role.id = actor_user_role.role_id
    where actor_user_role.profile_id = v_actor_id
      and actor_role.role_key = 'super-admin'
  ) then
    return query select false, 'super_admin_required',
      'Only a Super Admin can assign Super Admin access.', null::uuid;
    return;
  end if;

  begin
    insert into public.internal_authorized_users (
      email,
      role_id,
      status,
      notes,
      invited_at,
      created_by_profile_id,
      updated_by_profile_id
    )
    values (
      v_email,
      p_role_id,
      p_status,
      nullif(btrim(coalesce(p_notes, '')), ''),
      case when p_status = 'invited' then clock_timestamp() else null end,
      v_actor_id,
      v_actor_id
    )
    returning id into v_authorization_id;
  exception
    when unique_violation then
      return query select false, 'email_already_authorized',
        'This email already has an active internal authorization.', null::uuid;
      return;
  end;

  return query select true, 'created', 'Internal email authorized.', v_authorization_id;
end;
$$;

create function public.update_internal_authorized_user(
  p_authorization_id uuid,
  p_status text default null,
  p_notes text default null
)
returns table(success boolean, code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_current_status text;
  v_current_role_key text;
  v_next_status text;
begin
  if v_actor_id is null
    or not public.has_permission('settings.manage_roles_permissions') then
    return query select false, 'not_authorized',
      'You do not have permission to manage internal users.';
    return;
  end if;

  select internal_user.status, role.role_key
  into v_current_status, v_current_role_key
  from public.internal_authorized_users as internal_user
  join public.roles as role on role.id = internal_user.role_id
  where internal_user.id = p_authorization_id
  for update of internal_user;

  if not found then
    return query select false, 'authorization_not_found',
      'This internal authorization no longer exists.';
    return;
  end if;

  v_next_status := coalesce(p_status, v_current_status);

  if v_current_status = 'registered' and v_next_status <> 'registered' then
    return query select false, 'registered_status_protected',
      'Use Revoke to remove registered internal access.';
    return;
  end if;

  if v_current_status <> 'registered'
    and v_next_status not in ('allowed', 'invited')
    and not (v_current_status = 'revoked' and v_next_status = 'revoked') then
    return query select false, 'invalid_status',
      'Choose a valid authorization status.';
    return;
  end if;

  if v_current_status = 'revoked'
    and v_next_status <> 'revoked'
    and v_current_role_key = 'super-admin'
    and not exists (
      select 1
      from public.user_roles as actor_user_role
      join public.roles as actor_role on actor_role.id = actor_user_role.role_id
      where actor_user_role.profile_id = v_actor_id
        and actor_role.role_key = 'super-admin'
    ) then
    return query select false, 'super_admin_required',
      'Only a Super Admin can reauthorize Super Admin access.';
    return;
  end if;

  update public.internal_authorized_users as internal_user
  set
    status = v_next_status,
    notes = nullif(btrim(coalesce(p_notes, '')), ''),
    invited_at = case
      when v_next_status = 'invited' and v_current_status <> 'invited'
        then clock_timestamp()
      when v_next_status <> 'invited' then null
      else internal_user.invited_at
    end,
    revoked_at = case
      when v_next_status = 'revoked' then internal_user.revoked_at
      else null
    end,
    updated_by_profile_id = v_actor_id,
    updated_at = clock_timestamp()
  where internal_user.id = p_authorization_id;

  return query select true, 'updated', 'Internal authorization updated.';
end;
$$;

create function public.set_internal_authorized_user_role(
  p_authorization_id uuid,
  p_role_id uuid
)
returns table(success boolean, code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_super_admin_role_id uuid;
  v_current_role_id uuid;
  v_current_role_key text;
  v_next_role_key text;
  v_target_profile_id uuid;
  v_target_status text;
  v_other_super_admin_count integer;
begin
  if v_actor_id is null
    or not public.has_permission('settings.manage_roles_permissions') then
    return query select false, 'not_authorized',
      'You do not have permission to manage internal user roles.';
    return;
  end if;

  select role.id
  into v_super_admin_role_id
  from public.roles as role
  where role.role_key = 'super-admin'
  for update;

  if v_super_admin_role_id is null then
    return query select false, 'super_admin_role_missing',
      'The protected Super Admin role is unavailable.';
    return;
  end if;

  select
    internal_user.role_id,
    existing_role.role_key,
    internal_user.profile_id,
    internal_user.status
  into
    v_current_role_id,
    v_current_role_key,
    v_target_profile_id,
    v_target_status
  from public.internal_authorized_users as internal_user
  join public.roles as existing_role on existing_role.id = internal_user.role_id
  where internal_user.id = p_authorization_id
  for update of internal_user;

  if not found then
    return query select false, 'authorization_not_found',
      'This internal authorization no longer exists.';
    return;
  end if;

  select role.role_key
  into v_next_role_key
  from public.roles as role
  where role.id = p_role_id
    and role.role_key in (
      'super-admin',
      'admin-administrativo',
      'consulta-interna'
    );

  if v_next_role_key is null then
    return query select false, 'invalid_internal_role',
      'Choose a valid internal role.';
    return;
  end if;

  if v_next_role_key = 'super-admin' and not exists (
    select 1
    from public.user_roles as actor_user_role
    join public.roles as actor_role on actor_role.id = actor_user_role.role_id
    where actor_user_role.profile_id = v_actor_id
      and actor_role.role_key = 'super-admin'
  ) then
    return query select false, 'super_admin_required',
      'Only a Super Admin can assign Super Admin access.';
    return;
  end if;

  if v_current_role_id = p_role_id then
    return query select true, 'unchanged', 'The internal access level is unchanged.';
    return;
  end if;

  if v_current_role_key = 'super-admin'
    and v_next_role_key <> 'super-admin'
    and v_target_status = 'registered' then
    select count(*)
    into v_other_super_admin_count
    from public.internal_authorized_users as internal_user
    join public.user_roles as user_role
      on user_role.profile_id = internal_user.profile_id
      and user_role.role_id = v_super_admin_role_id
    where internal_user.role_id = v_super_admin_role_id
      and internal_user.status = 'registered'
      and internal_user.revoked_at is null
      and internal_user.id <> p_authorization_id;

    if v_other_super_admin_count = 0 then
      return query select false, 'last_super_admin',
        'The last active Super Admin cannot be demoted.';
      return;
    end if;
  end if;

  update public.internal_authorized_users as internal_user
  set
    role_id = p_role_id,
    updated_by_profile_id = v_actor_id,
    updated_at = clock_timestamp()
  where internal_user.id = p_authorization_id;

  if v_target_profile_id is not null then
    delete from public.user_roles as user_role
    using public.roles as role
    where user_role.role_id = role.id
      and user_role.profile_id = v_target_profile_id
      and role.role_key in (
        'super-admin',
        'admin-administrativo',
        'consulta-interna'
      );

    if v_target_status = 'registered' then
      insert into public.user_roles (
        profile_id,
        role_id,
        updated_by
      )
      values (
        v_target_profile_id,
        p_role_id,
        v_actor_id
      )
      on conflict on constraint user_roles_profile_role_key
      do update set
        updated_at = clock_timestamp(),
        updated_by = excluded.updated_by;
    end if;
  end if;

  insert into public.audit_logs (
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  values (
    v_actor_id,
    'internal_authorized_user',
    p_authorization_id,
    'internal_role_changed',
    jsonb_build_object(
      'role_id', v_current_role_id,
      'role_key', v_current_role_key
    ),
    jsonb_build_object(
      'role_id', p_role_id,
      'role_key', v_next_role_key
    ),
    jsonb_build_object(
      'target_profile_id', v_target_profile_id,
      'authorization_status', v_target_status
    )
  );

  return query select true, 'role_changed', 'Internal access level updated.';
end;
$$;

create function public.revoke_internal_authorized_user(
  p_authorization_id uuid
)
returns table(success boolean, code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_super_admin_role_id uuid;
  v_current_role_id uuid;
  v_current_role_key text;
  v_target_profile_id uuid;
  v_target_status text;
  v_other_super_admin_count integer;
begin
  if v_actor_id is null
    or not public.has_permission('settings.manage_roles_permissions') then
    return query select false, 'not_authorized',
      'You do not have permission to revoke internal access.';
    return;
  end if;

  select role.id
  into v_super_admin_role_id
  from public.roles as role
  where role.role_key = 'super-admin'
  for update;

  if v_super_admin_role_id is null then
    return query select false, 'super_admin_role_missing',
      'The protected Super Admin role is unavailable.';
    return;
  end if;

  select
    internal_user.role_id,
    role.role_key,
    internal_user.profile_id,
    internal_user.status
  into
    v_current_role_id,
    v_current_role_key,
    v_target_profile_id,
    v_target_status
  from public.internal_authorized_users as internal_user
  join public.roles as role on role.id = internal_user.role_id
  where internal_user.id = p_authorization_id
  for update of internal_user;

  if not found then
    return query select false, 'authorization_not_found',
      'This internal authorization no longer exists.';
    return;
  end if;

  if v_target_status = 'revoked' then
    return query select true, 'already_revoked', 'Internal authorization is already revoked.';
    return;
  end if;

  if v_current_role_key = 'super-admin'
    and v_target_status = 'registered' then
    select count(*)
    into v_other_super_admin_count
    from public.internal_authorized_users as internal_user
    join public.user_roles as user_role
      on user_role.profile_id = internal_user.profile_id
      and user_role.role_id = v_super_admin_role_id
    where internal_user.role_id = v_super_admin_role_id
      and internal_user.status = 'registered'
      and internal_user.revoked_at is null
      and internal_user.id <> p_authorization_id;

    if v_other_super_admin_count = 0 then
      return query select false, 'last_super_admin',
        'The last active Super Admin cannot be revoked.';
      return;
    end if;
  end if;

  update public.internal_authorized_users as internal_user
  set
    status = 'revoked',
    revoked_at = clock_timestamp(),
    updated_by_profile_id = v_actor_id,
    updated_at = clock_timestamp()
  where internal_user.id = p_authorization_id;

  if v_target_profile_id is not null then
    delete from public.user_roles as user_role
    using public.roles as role
    where user_role.role_id = role.id
      and user_role.profile_id = v_target_profile_id
      and role.role_key in (
        'super-admin',
        'admin-administrativo',
        'consulta-interna'
      );
  end if;

  insert into public.audit_logs (
    actor_profile_id,
    entity_type,
    entity_id,
    action,
    before_data,
    after_data,
    metadata
  )
  values (
    v_actor_id,
    'internal_authorized_user',
    p_authorization_id,
    'internal_authorization_revoked',
    jsonb_build_object(
      'role_id', v_current_role_id,
      'role_key', v_current_role_key,
      'status', v_target_status
    ),
    jsonb_build_object(
      'role_id', v_current_role_id,
      'role_key', v_current_role_key,
      'status', 'revoked'
    ),
    jsonb_build_object('target_profile_id', v_target_profile_id)
  );

  return query select true, 'revoked', 'Internal authorization revoked.';
end;
$$;

revoke all on function public.create_internal_authorized_user(text, uuid, text, text)
  from public, anon;
revoke all on function public.update_internal_authorized_user(uuid, text, text)
  from public, anon;
revoke all on function public.set_internal_authorized_user_role(uuid, uuid)
  from public, anon;
revoke all on function public.revoke_internal_authorized_user(uuid)
  from public, anon;

grant execute on function public.create_internal_authorized_user(text, uuid, text, text)
  to authenticated;
grant execute on function public.update_internal_authorized_user(uuid, text, text)
  to authenticated;
grant execute on function public.set_internal_authorized_user_role(uuid, uuid)
  to authenticated;
grant execute on function public.revoke_internal_authorized_user(uuid)
  to authenticated;

comment on function public.set_internal_authorized_user_role(uuid, uuid) is
  'Changes one stored internal access level and, for a registered user, atomically replaces only internal user_roles. Guide role bindings are preserved.';
comment on function public.revoke_internal_authorized_user(uuid) is
  'Revokes internal authorization, removes only linked internal user_roles, and prevents revoking the last active Super Admin.';

insert into public.translation_entries (key, context, description, english_source)
values
  ('settings.internal.role_change.action', 'Settings', 'Open the internal access-level change dialog.', 'Change access level'),
  ('settings.internal.role_change.title', 'Settings', 'Internal access-level change dialog title.', 'Change internal access level'),
  ('settings.internal.role_change.description', 'Settings', 'Internal access-level change dialog description.', 'Select the real internal role for {{email}}. Guide Portal access is unchanged.'),
  ('settings.internal.role_change.current', 'Settings', 'Current internal access-level label.', 'Current access level'),
  ('settings.internal.role_change.new', 'Settings', 'New internal access-level label.', 'New access level'),
  ('settings.internal.role_change.save', 'Settings', 'Save internal access-level action.', 'Save access level'),
  ('settings.internal.role_change.success', 'Settings', 'Internal access-level update success message.', 'Internal access level updated.'),
  ('settings.internal.role_change.revoked_notice', 'Settings', 'Role-change notice for a revoked internal authorization.', 'This user is revoked. Changing the stored access level will not reactivate internal access.'),
  ('settings.internal.role_change.use_action', 'Settings', 'Help text directing administrators to the dedicated role action.', 'Use the Change access level action to update this role safely.'),
  ('settings.internal.authorization_updated', 'Settings', 'Internal authorization metadata update success message.', 'Internal authorization updated.'),
  ('settings.internal.email_authorized', 'Settings', 'Internal email authorization success message.', 'Internal email authorized.'),
  ('settings.internal.revoke.confirm', 'Settings', 'Internal authorization revoke confirmation.', 'Revoke internal authorization for {{email}}? Internal access will stop; Guide Portal access is unchanged.'),
  ('settings.internal.revoke.success', 'Settings', 'Internal authorization revoke success message.', 'Internal authorization revoked.')
on conflict (key) do update
set
  context = excluded.context,
  description = excluded.description,
  english_source = excluded.english_source,
  updated_at = case
    when public.translation_entries.context is distinct from excluded.context
      or public.translation_entries.description is distinct from excluded.description
      or public.translation_entries.english_source is distinct from excluded.english_source
    then now()
    else public.translation_entries.updated_at
  end;
