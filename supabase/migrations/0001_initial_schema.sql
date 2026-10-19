-- Tour Guide Operations initial Supabase schema draft.
-- This migration is intentionally planning-first:
-- - No RLS policies are implemented yet.
-- - No seed data is inserted yet.
-- - Future migrations should add updated_at triggers, RLS policies, and seed data.

create extension if not exists pgcrypto;

create type supported_language as enum ('english', 'french', 'spanish', 'turkish');
create type guide_status as enum ('pending_invitation', 'invited', 'active', 'inactive', 'blocked');
create type group_status as enum ('active', 'cxl', 'fusionado', 'finalized');
create type assignment_status as enum ('without_guide', 'assigned');
create type confirmation_status as enum ('not_required', 'pending_confirmation', 'confirmed');
create type availability_status as enum ('available', 'not_available', 'occupied_by_assignment', 'pending_review');
create type availability_source as enum ('guide_submitted', 'admin_updated', 'assignment_generated');
create type change_request_status as enum ('pending', 'approved', 'rejected', 'completed', 'cancelled');
create type change_request_type as enum ('group_change', 'availability_change', 'profile_change', 'other');
create type notification_type as enum (
  'guide_invitation',
  'assigned_groups_email',
  'availability_conflict_alert',
  'group_without_guide_alert',
  'yearly_availability_request'
);

create table guides (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  authorized_email text not null,
  phone text null,
  preferred_language supported_language null,
  status guide_status not null default 'pending_invitation',
  internal_notes text null,
  internal_rating numeric(3, 2) null,
  sales_ranking integer null,
  sales_score numeric(8, 2) null,
  change_requests_count integer not null default 0,
  completed_change_requests_count integer not null default 0,
  rejected_change_requests_count integer not null default 0,
  pending_change_requests_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null,
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null,
  archive_reason text null,
  constraint guides_authorized_email_key unique (authorized_email),
  constraint guides_internal_rating_check check (internal_rating is null or (internal_rating >= 0 and internal_rating <= 5))
);

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text null,
  email text not null,
  guide_id uuid null references guides(id),
  preferred_language supported_language null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  constraint profiles_email_key unique (email)
);

alter table guides
  add constraint guides_updated_by_fkey foreign key (updated_by) references profiles(id),
  add constraint guides_archived_by_fkey foreign key (archived_by) references profiles(id);

create table roles (
  id uuid primary key default gen_random_uuid(),
  role_key text not null,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint roles_role_key_key unique (role_key),
  constraint roles_name_key unique (name)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  permission_key text not null,
  module_key text not null,
  name text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint permissions_permission_key_key unique (permission_key)
);

create table role_permissions (
  id uuid primary key default gen_random_uuid(),
  role_id uuid not null references roles(id) on delete cascade,
  permission_id uuid not null references permissions(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  constraint role_permissions_role_permission_key unique (role_id, permission_id)
);

create table user_roles (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  role_id uuid not null references roles(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  constraint user_roles_profile_role_key unique (profile_id, role_id)
);

create table circuits (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text null,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null references profiles(id),
  archive_reason text null,
  constraint circuits_name_key unique (name),
  constraint circuits_code_key unique (code)
);

create table circuit_aliases (
  id uuid primary key default gen_random_uuid(),
  circuit_id uuid not null references circuits(id) on delete cascade,
  alias text not null,
  normalized_alias text not null,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null references profiles(id),
  archive_reason text null,
  constraint circuit_aliases_normalized_alias_key unique (normalized_alias)
);

create table guide_circuit_capabilities (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  circuit_id uuid not null references circuits(id) on delete cascade,
  is_active boolean not null default true,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  constraint guide_circuit_capabilities_guide_circuit_key unique (guide_id, circuit_id)
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  group_code text not null,
  circuit_id uuid not null references circuits(id),
  start_date date not null,
  end_date date not null,
  group_status group_status not null default 'active',
  assignment_status assignment_status not null default 'without_guide',
  confirmation_status confirmation_status not null default 'not_required',
  language supported_language null,
  estimated_passengers integer null,
  internal_notes text null,
  main_group_id uuid null references groups(id),
  merged_with_group_id uuid null references groups(id),
  last_modified_by uuid null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null references profiles(id),
  archive_reason text null,
  constraint groups_group_code_key unique (group_code),
  constraint groups_date_order_check check (end_date >= start_date),
  constraint groups_estimated_passengers_check check (estimated_passengers is null or estimated_passengers >= 0)
);

create table assignments (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  guide_id uuid null references guides(id),
  status assignment_status not null default 'assigned',
  confirmation_status confirmation_status not null default 'pending_confirmation',
  assigned_at timestamptz not null default now(),
  assigned_by uuid null references profiles(id),
  confirmed_at timestamptz null,
  confirmed_by uuid null references profiles(id),
  is_current boolean not null default true,
  replaced_by_assignment_id uuid null references assignments(id),
  change_reason text null,
  changed_at timestamptz null,
  changed_by uuid null references profiles(id),
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null references profiles(id),
  archive_reason text null
);

create unique index assignments_one_current_per_group_idx
  on assignments (group_id)
  where is_current = true;

create table availability (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  assignment_id uuid null references assignments(id) on delete set null,
  status availability_status not null,
  source availability_source not null,
  start_date date not null,
  end_date date not null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null references profiles(id),
  archive_reason text null,
  constraint availability_date_order_check check (end_date >= start_date)
);

create table change_requests (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid not null references guides(id) on delete cascade,
  group_id uuid null references groups(id) on delete set null,
  request_type change_request_type not null,
  request_status change_request_status not null default 'pending',
  requested_at timestamptz not null default now(),
  resolved_at timestamptz null,
  resolved_by uuid null references profiles(id),
  reason text null,
  notes text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null references profiles(id),
  archive_reason text null
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_profile_id uuid null references profiles(id),
  entity_type text not null,
  entity_id uuid null,
  action text not null,
  before_data jsonb null,
  after_data jsonb null,
  metadata jsonb null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table app_settings (
  id uuid primary key default gen_random_uuid(),
  setting_key text not null,
  setting_value jsonb not null default '{}'::jsonb,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  constraint app_settings_setting_key_key unique (setting_key)
);

create table notification_settings (
  id uuid primary key default gen_random_uuid(),
  notification_type notification_type not null,
  is_enabled boolean not null default true,
  primary_recipient_label text not null,
  internal_copy_role_ids uuid[] not null default '{}'::uuid[],
  manual_copy_emails text[] not null default '{}'::text[],
  sender_role_ids uuid[] not null default '{}'::uuid[],
  trigger_type text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null references profiles(id),
  archive_reason text null,
  constraint notification_settings_type_key unique (notification_type)
);

create table email_templates (
  id uuid primary key default gen_random_uuid(),
  template_type text not null,
  language supported_language not null,
  subject text not null,
  body text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid null references profiles(id),
  is_archived boolean not null default false,
  archived_at timestamptz null,
  archived_by uuid null references profiles(id),
  archive_reason text null,
  constraint email_templates_type_language_key unique (template_type, language)
);

create index permissions_module_key_idx on permissions (module_key);
create index circuit_aliases_circuit_id_idx on circuit_aliases (circuit_id);
create index guide_circuit_capabilities_guide_id_idx on guide_circuit_capabilities (guide_id);
create index guide_circuit_capabilities_circuit_id_idx on guide_circuit_capabilities (circuit_id);
create index groups_circuit_id_idx on groups (circuit_id);
create index groups_start_end_idx on groups (start_date, end_date);
create index assignments_group_id_idx on assignments (group_id);
create index assignments_guide_id_idx on assignments (guide_id);
create index availability_guide_id_idx on availability (guide_id);
create index availability_assignment_id_idx on availability (assignment_id);
create index availability_start_end_idx on availability (start_date, end_date);
create index change_requests_guide_id_idx on change_requests (guide_id);
create index change_requests_group_id_idx on change_requests (group_id);
create index audit_logs_actor_profile_id_idx on audit_logs (actor_profile_id);
create index audit_logs_entity_idx on audit_logs (entity_type, entity_id);

comment on table assignments is
  'Stores guide assignment history. Display current assignment where is_current = true; old rows remain for audit/history.';
comment on index assignments_one_current_per_group_idx is
  'Allows only one current assignment per group.';
comment on table guide_circuit_capabilities is
  'Many-to-many guide-to-circuit capability table replacing mock guide.circuitIds arrays.';
comment on table circuit_aliases is
  'Maps raw Excel/import circuit values to official app circuits using normalized aliases.';
comment on table availability is
  'Availability records. Not available exceptions override available ranges; assignment-generated records are protected operationally.';

-- Planned RLS direction:
-- Super Admin: read/write all.
-- Admin Administrativo: manage operational data.
-- Consulta Interna: read allowed operational data.
-- Guide: read/update only own profile, availability, assigned groups, and change requests.
-- Settings and permissions: Super Admin only.
--
-- Planned triggers:
-- - before update set updated_at = now()
-- - audit write operations into audit_logs
-- - optional normalization trigger for circuit_aliases.normalized_alias
