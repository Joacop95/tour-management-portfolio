-- Atomic, permission-checked administration of real internal role permissions.

-- Role grants must only be changed through the protected atomic function below.
drop policy if exists "role_permissions_insert_security_admin" on public.role_permissions;
drop policy if exists "role_permissions_update_security_admin" on public.role_permissions;
drop policy if exists "role_permissions_delete_security_admin" on public.role_permissions;
revoke insert, update, delete on table public.role_permissions from authenticated;

create or replace function public.replace_role_permissions(
  p_role_id uuid,
  p_permission_keys text[]
)
returns table(success boolean, code text, message text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_key text;
  v_permission_keys text[] := coalesce(p_permission_keys, '{}'::text[]);
  v_invalid_keys text[];
begin
  if auth.uid() is null or not public.has_permission('settings.manage_roles_permissions') then
    return query select false, 'not_authorized', 'You do not have permission to manage role permissions.';
    return;
  end if;

  select roles.role_key
  into v_role_key
  from public.roles
  where roles.id = p_role_id
  for update;

  if v_role_key is null then
    return query select false, 'role_not_found', 'The selected role no longer exists.';
    return;
  end if;

  if v_role_key = 'guide' then
    return query select false, 'guide_role_protected', 'Guide Portal permissions are managed separately.';
    return;
  end if;

  select coalesce(array_agg(input_key order by input_key), '{}'::text[])
  into v_invalid_keys
  from (
    select distinct btrim(key_value) as input_key
    from unnest(v_permission_keys) as key_value
    where btrim(key_value) <> ''
      and not exists (
        select 1
        from public.permissions
        where permissions.permission_key = btrim(key_value)
      )
  ) invalid;

  if cardinality(v_invalid_keys) > 0 then
    return query select false, 'invalid_permissions', 'One or more permission keys are invalid.';
    return;
  end if;

  if v_role_key = 'super-admin' and not (
    'settings.view' = any(v_permission_keys)
    and 'settings.manage_roles_permissions' = any(v_permission_keys)
  ) then
    return query select false, 'protected_permissions', 'Super Admin must retain Settings access and role-permission management.';
    return;
  end if;

  delete from public.role_permissions
  where role_permissions.role_id = p_role_id;

  insert into public.role_permissions (role_id, permission_id, updated_by)
  select p_role_id, permissions.id, auth.uid()
  from public.permissions
  where permissions.permission_key in (
    select distinct btrim(key_value)
    from unnest(v_permission_keys) as key_value
    where btrim(key_value) <> ''
  );

  return query select true, 'saved', 'Role permissions saved.';
end;
$$;

revoke all on function public.replace_role_permissions(uuid, text[]) from public;
revoke all on function public.replace_role_permissions(uuid, text[]) from anon;
grant execute on function public.replace_role_permissions(uuid, text[]) to authenticated;

comment on function public.replace_role_permissions(uuid, text[]) is
  'Atomically replaces permissions for an internal role. Requires real settings.manage_roles_permissions authority and preserves Super Admin recovery permissions.';
