-- RLS Stage 2A: low-risk operational reference tables only.
--
-- Scope:
-- - circuits
-- - circuit_aliases
-- - guides
-- - guide_circuit_capabilities
--
-- This migration intentionally does not enable RLS on groups, assignments,
-- availability, change_requests, audit_logs, app_settings,
-- notification_settings, email_templates, or any other operational table.

alter table public.circuits enable row level security;
alter table public.circuit_aliases enable row level security;
alter table public.guides enable row level security;
alter table public.guide_circuit_capabilities enable row level security;

-- circuits
create policy "circuits_select_active_or_settings_admin"
on public.circuits
for select
to authenticated
using (
  (is_active = true and is_archived = false)
  or public.has_permission('settings.manage_settings')
);

create policy "circuits_insert_settings_admin"
on public.circuits
for insert
to authenticated
with check (
  public.has_permission('settings.manage_settings')
);

create policy "circuits_update_settings_admin"
on public.circuits
for update
to authenticated
using (
  public.has_permission('settings.manage_settings')
)
with check (
  public.has_permission('settings.manage_settings')
);

create policy "circuits_delete_settings_admin"
on public.circuits
for delete
to authenticated
using (
  public.has_permission('settings.manage_settings')
);

-- circuit_aliases
create policy "circuit_aliases_select_active_circuits_or_settings_admin"
on public.circuit_aliases
for select
to authenticated
using (
  public.has_permission('settings.manage_settings')
  or (
    is_active = true
    and is_archived = false
    and exists (
      select 1
      from public.circuits
      where circuits.id = circuit_aliases.circuit_id
        and circuits.is_active = true
        and circuits.is_archived = false
    )
  )
);

create policy "circuit_aliases_insert_settings_admin"
on public.circuit_aliases
for insert
to authenticated
with check (
  public.has_permission('settings.manage_settings')
);

create policy "circuit_aliases_update_settings_admin"
on public.circuit_aliases
for update
to authenticated
using (
  public.has_permission('settings.manage_settings')
)
with check (
  public.has_permission('settings.manage_settings')
);

create policy "circuit_aliases_delete_settings_admin"
on public.circuit_aliases
for delete
to authenticated
using (
  public.has_permission('settings.manage_settings')
);

-- guides
create policy "guides_select_operational_or_own_guide"
on public.guides
for select
to authenticated
using (
  id = public.current_user_guide_id()
  or public.has_permission('guides.view')
  or public.has_permission('groups.view')
  or public.has_permission('assignments.view')
);

create policy "guides_insert_guides_create"
on public.guides
for insert
to authenticated
with check (
  public.has_permission('guides.create')
);

create policy "guides_update_guides_edit"
on public.guides
for update
to authenticated
using (
  public.has_permission('guides.edit')
)
with check (
  public.has_permission('guides.edit')
);

create policy "guides_delete_guides_edit"
on public.guides
for delete
to authenticated
using (
  public.has_permission('guides.edit')
);

-- guide_circuit_capabilities
create policy "guide_circuit_capabilities_select_operational_or_own"
on public.guide_circuit_capabilities
for select
to authenticated
using (
  guide_id = public.current_user_guide_id()
  or public.has_permission('guides.view')
  or public.has_permission('assignments.view')
);

create policy "guide_circuit_capabilities_insert_guides_edit"
on public.guide_circuit_capabilities
for insert
to authenticated
with check (
  public.has_permission('guides.edit')
);

create policy "guide_circuit_capabilities_update_guides_edit"
on public.guide_circuit_capabilities
for update
to authenticated
using (
  public.has_permission('guides.edit')
)
with check (
  public.has_permission('guides.edit')
);

create policy "guide_circuit_capabilities_delete_guides_edit"
on public.guide_circuit_capabilities
for delete
to authenticated
using (
  public.has_permission('guides.edit')
);

comment on table public.circuits is
  'RLS Stage 2A enabled. Authenticated users can read active non-archived circuits; settings managers can manage circuits.';
comment on table public.circuit_aliases is
  'RLS Stage 2A enabled. Authenticated users can read active aliases for active non-archived circuits; settings managers can manage aliases.';
comment on table public.guides is
  'RLS Stage 2A enabled. Operational users can read guides by permission; guide users can read their linked guide row. RLS does not hide columns.';
comment on table public.guide_circuit_capabilities is
  'RLS Stage 2A enabled. Operational users can read guide capabilities by permission; guide users can read their own capabilities.';
