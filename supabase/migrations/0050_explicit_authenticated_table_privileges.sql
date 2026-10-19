-- Make browser table privileges deterministic across local and hosted
-- Supabase environments. RLS remains the row-level authority; these grants
-- only allow PostgREST to reach the existing policies.

-- Authenticated browser reads used to resolve the current profile, roles, and
-- permissions. PROD-2 keeps every direct write on these tables revoked.
revoke all privileges on table
  public.profiles,
  public.user_roles,
  public.roles,
  public.role_permissions,
  public.permissions
from public, anon, authenticated;

grant select on table
  public.profiles,
  public.user_roles,
  public.roles,
  public.role_permissions,
  public.permissions
to authenticated;

-- Operational tables read directly by internal modules. Group and assignment
-- writes remain RPC-only after PROD-2B. Annual submission writes remain
-- RPC-only for Guide and internal review workflows.
revoke all privileges on table
  public.groups,
  public.assignments,
  public.guide_availability_submissions,
  public.internal_authorized_users
from public, anon, authenticated;

grant select on table
  public.groups,
  public.assignments,
  public.guide_availability_submissions,
  public.internal_authorized_users
to authenticated;

-- Policy-backed browser-managed operational and Settings records. Existing
-- RLS policies retain the real permission/ownership checks. Physical DELETE
-- is not a browser workflow, so no table receives DELETE.
revoke all privileges on table
  public.circuits,
  public.circuit_aliases,
  public.guides,
  public.guide_circuit_capabilities,
  public.availability,
  public.change_requests,
  public.group_code_circuit_mappings,
  public.guide_authorized_emails,
  public.app_settings,
  public.notification_settings,
  public.email_templates
from public, anon, authenticated;

grant select, insert, update on table
  public.circuits,
  public.circuit_aliases,
  public.guides,
  public.guide_circuit_capabilities,
  public.availability,
  public.change_requests,
  public.group_code_circuit_mappings,
  public.guide_authorized_emails,
  public.app_settings,
  public.notification_settings,
  public.email_templates
to authenticated;

-- Guide Portal reads use filtered, column-safe views. Base-table RLS policies
-- intentionally do not expose Guide-owned operational rows after PROD-2.
revoke all privileges on table
  public.guide_portal_guides,
  public.guide_portal_groups,
  public.guide_portal_assignments,
  public.guide_portal_availability,
  public.guide_portal_change_requests
from public, anon, authenticated;

grant select on table
  public.guide_portal_guides,
  public.guide_portal_groups,
  public.guide_portal_assignments,
  public.guide_portal_availability,
  public.guide_portal_change_requests
to authenticated;

-- These tables are consumed only through permission-checked RPCs/triggers.
-- Reassert the browser deny-all boundary rather than relying on platform
-- default privileges.
revoke all privileges on table
  public.audit_logs,
  public.assignment_notification_outbox,
  public.translation_entries,
  public.translation_values
from public, anon, authenticated;

comment on table public.profiles is
  'RLS protected. Authenticated browser SELECT is explicit; direct browser writes remain denied.';
comment on table public.groups is
  'RLS protected. Authenticated browser SELECT is explicit; create/update assignment-aware workflows remain RPC-only.';
comment on table public.assignments is
  'RLS protected. Authenticated browser SELECT is explicit; assignment mutations remain RPC-only.';
