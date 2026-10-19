-- Prepare change_requests for the future Guide Portal request workflow.
-- This migration is schema/seed preparation only.
-- It intentionally does not enable RLS, create policies, connect writes,
-- add API routes, or add server actions.

alter type change_request_status add value if not exists 'in_progress';

alter table change_requests
  add column if not exists assignment_id uuid null references assignments(id) on delete set null,
  add column if not exists availability_id uuid null references availability(id) on delete set null,
  add column if not exists created_by_profile_id uuid null references profiles(id),
  add column if not exists guide_message text null,
  add column if not exists internal_notes text null,
  add column if not exists reviewed_by_profile_id uuid null references profiles(id),
  add column if not exists reviewed_at timestamptz null,
  add column if not exists completed_at timestamptz null,
  add column if not exists cancelled_at timestamptz null,
  add column if not exists decision_reason text null;

create index if not exists change_requests_guide_status_idx
  on change_requests (guide_id, request_status)
  where is_archived = false;

create index if not exists change_requests_status_idx
  on change_requests (request_status)
  where is_archived = false;

create index if not exists change_requests_assignment_id_idx
  on change_requests (assignment_id);

create index if not exists change_requests_availability_id_idx
  on change_requests (availability_id);

create index if not exists change_requests_created_by_profile_id_idx
  on change_requests (created_by_profile_id);

create index if not exists change_requests_reviewed_by_profile_id_idx
  on change_requests (reviewed_by_profile_id);

comment on column change_requests.assignment_id is
  'Optional link to an assignment when a request concerns a specific assignment.';
comment on column change_requests.availability_id is
  'Optional link to an availability row when a request concerns a specific availability period.';
comment on column change_requests.created_by_profile_id is
  'Auth profile that created the request. Guide-created requests should match the guide profile.';
comment on column change_requests.guide_message is
  'Guide-visible message submitted by the guide or entered on the guide behalf.';
comment on column change_requests.internal_notes is
  'Internal-only review notes. Do not expose through Guide Portal safe views.';
comment on column change_requests.reviewed_by_profile_id is
  'Internal profile that reviewed the request.';
comment on column change_requests.reviewed_at is
  'Timestamp when internal review started or review decision was recorded.';
comment on column change_requests.completed_at is
  'Timestamp when the request was completed.';
comment on column change_requests.cancelled_at is
  'Timestamp when the request was cancelled.';
comment on column change_requests.decision_reason is
  'Guide-visible or internal decision summary, depending on future workflow policy.';

insert into permissions (id, module_key, permission_key, name, description)
values
  (
    '10000000-0000-4000-8000-000000000034',
    'change_requests',
    'change_requests.view',
    'View change requests',
    'View guide change requests.'
  ),
  (
    '10000000-0000-4000-8000-000000000035',
    'change_requests',
    'change_requests.review',
    'Review change requests',
    'Approve, reject, complete, or otherwise review guide change requests.'
  ),
  (
    '10000000-0000-4000-8000-000000000036',
    'change_requests',
    'change_requests.create_internal',
    'Create internal change requests',
    'Create guide change requests from internal/admin workflows.'
  ),
  (
    '10000000-0000-4000-8000-000000000037',
    'change_requests',
    'change_requests.archive',
    'Archive change requests',
    'Archive guide change requests.'
  )
on conflict (permission_key) do update
set
  module_key = excluded.module_key,
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.permission_key in (
  'change_requests.view',
  'change_requests.review',
  'change_requests.create_internal',
  'change_requests.archive'
)
where roles.role_key in ('super-admin', 'admin-administrativo')
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.permission_key = 'change_requests.view'
where roles.role_key = 'consulta-interna'
on conflict (role_id, permission_id) do nothing;
