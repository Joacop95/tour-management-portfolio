-- RLS Stage 1: auth/profile/permission reference tables only.
--
-- Scope:
-- - profiles
-- - roles
-- - permissions
-- - user_roles
-- - role_permissions
--
-- This migration intentionally does not enable RLS on operational tables and
-- does not create policies for guides, circuits, groups, assignments,
-- availability, settings, notifications, email templates, or audit logs.

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.role_permissions enable row level security;

-- profiles
create policy "profiles_select_self_or_security_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.has_permission('settings.manage_roles_permissions')
);

create policy "profiles_insert_security_admin"
on public.profiles
for insert
to authenticated
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "profiles_update_security_admin"
on public.profiles
for update
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
)
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "profiles_delete_security_admin"
on public.profiles
for delete
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
);

-- roles
create policy "roles_select_authenticated"
on public.roles
for select
to authenticated
using (true);

create policy "roles_insert_security_admin"
on public.roles
for insert
to authenticated
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "roles_update_security_admin"
on public.roles
for update
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
)
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "roles_delete_security_admin"
on public.roles
for delete
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
);

-- permissions
create policy "permissions_select_authenticated"
on public.permissions
for select
to authenticated
using (true);

create policy "permissions_insert_security_admin"
on public.permissions
for insert
to authenticated
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "permissions_update_security_admin"
on public.permissions
for update
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
)
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "permissions_delete_security_admin"
on public.permissions
for delete
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
);

-- user_roles
create policy "user_roles_select_self_or_security_admin"
on public.user_roles
for select
to authenticated
using (
  profile_id = auth.uid()
  or public.has_permission('settings.manage_roles_permissions')
);

create policy "user_roles_insert_security_admin"
on public.user_roles
for insert
to authenticated
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "user_roles_update_security_admin"
on public.user_roles
for update
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
)
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "user_roles_delete_security_admin"
on public.user_roles
for delete
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
);

-- role_permissions
create policy "role_permissions_select_own_roles_or_security_admin"
on public.role_permissions
for select
to authenticated
using (
  exists (
    select 1
    from public.user_roles
    where user_roles.profile_id = auth.uid()
      and user_roles.role_id = role_permissions.role_id
  )
  or public.has_permission('settings.manage_roles_permissions')
);

create policy "role_permissions_insert_security_admin"
on public.role_permissions
for insert
to authenticated
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "role_permissions_update_security_admin"
on public.role_permissions
for update
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
)
with check (
  public.has_permission('settings.manage_roles_permissions')
);

create policy "role_permissions_delete_security_admin"
on public.role_permissions
for delete
to authenticated
using (
  public.has_permission('settings.manage_roles_permissions')
);

comment on table public.profiles is
  'RLS Stage 1 enabled. Authenticated users can read their own profile; security admins can manage profiles.';
comment on table public.roles is
  'RLS Stage 1 enabled. Authenticated users can read role labels/keys; security admins can manage roles.';
comment on table public.permissions is
  'RLS Stage 1 enabled. Authenticated users can read permission keys; security admins can manage permissions.';
comment on table public.user_roles is
  'RLS Stage 1 enabled. Authenticated users can read their own role mappings; security admins can manage user-role mappings.';
comment on table public.role_permissions is
  'RLS Stage 1 enabled. Authenticated users can read permission mappings for their own roles; security admins can manage role-permission mappings.';
