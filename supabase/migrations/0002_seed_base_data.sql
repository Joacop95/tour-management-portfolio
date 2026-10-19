-- Tour Guide Operations base seed data.
-- Safe to run after 0001_initial_schema.sql.
-- No users, profiles, auth records, RLS policies, or sensitive data are seeded here.

insert into roles (id, role_key, name, description)
values
  ('00000000-0000-4000-8000-000000000001', 'super-admin', 'Super Admin', 'Full system access.'),
  ('00000000-0000-4000-8000-000000000002', 'admin-administrativo', 'Admin Administrativo', 'Operational admin access without full role management by default.'),
  ('00000000-0000-4000-8000-000000000003', 'consulta-interna', 'Consulta Interna', 'Internal read-only operational access.'),
  ('00000000-0000-4000-8000-000000000004', 'guide', 'Guide', 'Guide Portal access for guide users.')
on conflict (role_key) do update
set
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into permissions (id, module_key, permission_key, name, description)
values
  ('10000000-0000-4000-8000-000000000001', 'dashboard', 'dashboard.view', 'View dashboard', 'View dashboard summary and operational alerts.'),
  ('10000000-0000-4000-8000-000000000002', 'planning', 'planning.view', 'View planning', 'View spreadsheet-style planning timeline.'),
  ('10000000-0000-4000-8000-000000000003', 'groups', 'groups.view', 'View groups', 'View tour groups.'),
  ('10000000-0000-4000-8000-000000000004', 'groups', 'groups.create', 'Create groups', 'Create tour groups.'),
  ('10000000-0000-4000-8000-000000000005', 'groups', 'groups.edit', 'Edit groups', 'Edit tour groups.'),
  ('10000000-0000-4000-8000-000000000006', 'groups', 'groups.assign_guide', 'Assign guides', 'Assign guides from group workflows.'),
  ('10000000-0000-4000-8000-000000000007', 'groups', 'groups.confirm_guide', 'Confirm guides', 'Confirm guide assignments.'),
  ('10000000-0000-4000-8000-000000000008', 'groups', 'groups.export', 'Export groups', 'Export group data.'),
  ('10000000-0000-4000-8000-000000000009', 'guides', 'guides.view', 'View guides', 'View guide profiles.'),
  ('10000000-0000-4000-8000-000000000010', 'guides', 'guides.create', 'Create guides', 'Create guide profiles.'),
  ('10000000-0000-4000-8000-000000000011', 'guides', 'guides.edit', 'Edit guides', 'Edit guide profiles.'),
  ('10000000-0000-4000-8000-000000000012', 'guides', 'guides.view_internal_metrics', 'View internal metrics', 'View guide internal rating and sales metrics.'),
  ('10000000-0000-4000-8000-000000000013', 'guides', 'guides.view_change_request_metrics', 'View change request metrics', 'View guide change-request counts.'),
  ('10000000-0000-4000-8000-000000000014', 'availability', 'availability.view', 'View availability', 'View guide availability.'),
  ('10000000-0000-4000-8000-000000000015', 'availability', 'availability.create', 'Create availability', 'Create guide availability periods.'),
  ('10000000-0000-4000-8000-000000000016', 'availability', 'availability.edit', 'Edit availability', 'Edit guide availability periods.'),
  ('10000000-0000-4000-8000-000000000017', 'availability', 'availability.delete', 'Delete availability', 'Archive/delete manual availability periods.'),
  ('10000000-0000-4000-8000-000000000018', 'assignments', 'assignments.view', 'View assignments', 'View assignment workbench.'),
  ('10000000-0000-4000-8000-000000000019', 'assignments', 'assignments.assign_guide', 'Assign guide', 'Assign a guide to a group.'),
  ('10000000-0000-4000-8000-000000000020', 'assignments', 'assignments.change_guide', 'Change guide', 'Replace the current guide assignment.'),
  ('10000000-0000-4000-8000-000000000021', 'assignments', 'assignments.confirm_guide', 'Confirm guide', 'Confirm a selected guide assignment.'),
  ('10000000-0000-4000-8000-000000000022', 'import_export', 'import_export.view', 'View import export', 'View Import / Export module.'),
  ('10000000-0000-4000-8000-000000000023', 'import_export', 'import_export.import_excel', 'Import Excel', 'Import group data from Excel.'),
  ('10000000-0000-4000-8000-000000000024', 'import_export', 'import_export.export_excel', 'Export Excel', 'Export group data to Excel.'),
  ('10000000-0000-4000-8000-000000000025', 'settings', 'settings.view', 'View settings', 'View Settings / Admin module.'),
  ('10000000-0000-4000-8000-000000000026', 'settings', 'settings.manage_settings', 'Manage settings', 'Manage general app settings.'),
  ('10000000-0000-4000-8000-000000000027', 'settings', 'settings.manage_roles_permissions', 'Manage roles permissions', 'Manage roles and permissions.'),
  ('10000000-0000-4000-8000-000000000028', 'settings', 'settings.manage_email_templates', 'Manage email templates', 'Manage email template content.'),
  ('10000000-0000-4000-8000-000000000029', 'settings', 'settings.manage_notification_settings', 'Manage notification settings', 'Manage notification recipients and sender roles.'),
  ('10000000-0000-4000-8000-000000000030', 'guide_portal', 'guide_portal.view_own_profile', 'View own profile', 'Guide can view own profile.'),
  ('10000000-0000-4000-8000-000000000031', 'guide_portal', 'guide_portal.view_own_groups', 'View own groups', 'Guide can view own assigned groups.'),
  ('10000000-0000-4000-8000-000000000032', 'guide_portal', 'guide_portal.edit_own_availability', 'Edit own availability', 'Guide can manage own availability.'),
  ('10000000-0000-4000-8000-000000000033', 'guide_portal', 'guide_portal.request_group_change', 'Request group change', 'Guide can request assignment changes.')
on conflict (permission_key) do update
set
  module_key = excluded.module_key,
  name = excluded.name,
  description = excluded.description,
  updated_at = now();

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
cross join permissions
where roles.role_key = 'super-admin'
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.permission_key in (
  'dashboard.view',
  'planning.view',
  'groups.view',
  'groups.create',
  'groups.edit',
  'groups.assign_guide',
  'groups.confirm_guide',
  'groups.export',
  'guides.view',
  'guides.create',
  'guides.edit',
  'guides.view_internal_metrics',
  'guides.view_change_request_metrics',
  'availability.view',
  'availability.create',
  'availability.edit',
  'availability.delete',
  'assignments.view',
  'assignments.assign_guide',
  'assignments.change_guide',
  'assignments.confirm_guide',
  'import_export.view',
  'import_export.import_excel',
  'import_export.export_excel',
  'settings.view',
  'settings.manage_email_templates',
  'settings.manage_notification_settings'
)
where roles.role_key = 'admin-administrativo'
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.permission_key in (
  'dashboard.view',
  'planning.view',
  'groups.view',
  'guides.view',
  'availability.view',
  'assignments.view',
  'import_export.view'
)
where roles.role_key = 'consulta-interna'
on conflict (role_id, permission_id) do nothing;

insert into role_permissions (role_id, permission_id)
select roles.id, permissions.id
from roles
join permissions on permissions.permission_key in (
  'guide_portal.view_own_profile',
  'guide_portal.view_own_groups',
  'guide_portal.edit_own_availability',
  'guide_portal.request_group_change'
)
where roles.role_key = 'guide'
on conflict (role_id, permission_id) do nothing;

insert into circuits (id, name, code, is_active, notes, created_at, updated_at)
values
  ('20000000-0000-4000-8000-000000000001', 'Barcelona Essentials', 'BCN-ESS', true, 'Common supplier abbreviations for Barcelona programs.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('20000000-0000-4000-8000-000000000002', 'Paris to Loire', 'PAR-LOR', true, 'Matches raw import values without the connecting word.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('20000000-0000-4000-8000-000000000003', 'Istanbul Heritage', 'IST-HER', true, 'Includes Spanish supplier spelling.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('20000000-0000-4000-8000-000000000004', 'Andalusia Highlights', 'AND-HIL', true, 'Accent-insensitive matching handles Andalucia and Andalucía.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('20000000-0000-4000-8000-000000000005', 'Madrid Art Week', 'MAD-ART', true, 'Short and full import labels.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00')
on conflict (name) do update
set
  code = excluded.code,
  is_active = excluded.is_active,
  notes = excluded.notes,
  updated_at = now();

insert into circuit_aliases (id, circuit_id, alias, normalized_alias, is_active, notes, created_at, updated_at)
values
  ('21000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000001', 'BARCELONA', 'barcelona', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000001', 'BCN', 'bcn', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000001', 'BCN ESSENTIALS', 'bcn essentials', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', 'Barcelona Essentials', 'barcelona essentials', true, 'Official app circuit name accepted as an import value.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000002', 'PARIS LOIRE', 'paris loire', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000002', 'Paris-Loire', 'paris-loire', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000007', '20000000-0000-4000-8000-000000000002', 'Paris to Loire', 'paris to loire', true, 'Official app circuit name accepted as an import value.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000008', '20000000-0000-4000-8000-000000000003', 'ISTANBUL', 'istanbul', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000009', '20000000-0000-4000-8000-000000000003', 'ISTANBUL HERITAGE', 'istanbul heritage', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000010', '20000000-0000-4000-8000-000000000003', 'Estambul', 'estambul', true, 'Spanish supplier spelling.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000011', '20000000-0000-4000-8000-000000000004', 'ANDALUSIA', 'andalusia', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000012', '20000000-0000-4000-8000-000000000004', 'Andalucia Highlights', 'andalucia highlights', true, 'Accent-insensitive import spelling.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000014', '20000000-0000-4000-8000-000000000004', 'Andalusia Highlights', 'andalusia highlights', true, 'Official app circuit name accepted as an import value.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000015', '20000000-0000-4000-8000-000000000005', 'MADRID ART', 'madrid art', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('21000000-0000-4000-8000-000000000016', '20000000-0000-4000-8000-000000000005', 'MADRID ART WEEK', 'madrid art week', true, 'Seeded mock import alias.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00')
on conflict (normalized_alias) do update
set
  circuit_id = excluded.circuit_id,
  alias = excluded.alias,
  is_active = excluded.is_active,
  notes = excluded.notes,
  updated_at = now();

insert into app_settings (setting_key, setting_value, description)
values
  (
    'general',
    '{
      "defaultLanguage": "english",
      "defaultGroupLanguage": "spanish"
    }'::jsonb,
    'Base general app settings.'
  ),
  (
    'display',
    '{
      "showInternalGuideMetrics": true,
      "showGuideChangeRequestMetrics": true,
      "showInternalNotes": true,
      "showSalesRanking": true
    }'::jsonb,
    'Base display settings.'
  ),
  (
    'availability',
    '{
      "minimumYear": 2026,
      "maximumYear": 2040,
      "defaultSelectedAvailabilityYear": 2026
    }'::jsonb,
    'Base availability year settings.'
  ),
  (
    'guideMetrics',
    '{
      "enableInternalRating": true,
      "enableSalesRanking": true,
      "enableSalesScore": true
    }'::jsonb,
    'Base guide metrics settings.'
  )
on conflict (setting_key) do update
set
  setting_value = excluded.setting_value,
  description = excluded.description,
  updated_at = now();

insert into notification_settings (
  notification_type,
  is_enabled,
  primary_recipient_label,
  internal_copy_role_ids,
  manual_copy_emails,
  sender_role_ids,
  trigger_type
)
values
  (
    'guide_invitation',
    true,
    'Invited guide',
    array[
      (select id from roles where role_key = 'super-admin'),
      (select id from roles where role_key = 'admin-administrativo')
    ]::uuid[],
    '{}'::text[],
    array[
      (select id from roles where role_key = 'super-admin'),
      (select id from roles where role_key = 'admin-administrativo')
    ]::uuid[],
    'admin_action'
  ),
  (
    'assigned_groups_email',
    true,
    'Assigned guide',
    '{}'::uuid[],
    '{}'::text[],
    array[
      (select id from roles where role_key = 'super-admin'),
      (select id from roles where role_key = 'admin-administrativo')
    ]::uuid[],
    'admin_action'
  ),
  (
    'availability_conflict_alert',
    true,
    'Internal recipient roles',
    array[
      (select id from roles where role_key = 'super-admin'),
      (select id from roles where role_key = 'admin-administrativo')
    ]::uuid[],
    '{}'::text[],
    '{}'::uuid[],
    'system_or_admin_action_mock'
  ),
  (
    'group_without_guide_alert',
    true,
    'Internal recipient roles',
    array[
      (select id from roles where role_key = 'super-admin'),
      (select id from roles where role_key = 'admin-administrativo')
    ]::uuid[],
    '{}'::text[],
    '{}'::uuid[],
    'system_alert_mock'
  ),
  (
    'yearly_availability_request',
    true,
    'Active guides',
    array[
      (select id from roles where role_key = 'super-admin'),
      (select id from roles where role_key = 'admin-administrativo')
    ]::uuid[],
    '{}'::text[],
    array[
      (select id from roles where role_key = 'super-admin'),
      (select id from roles where role_key = 'admin-administrativo')
    ]::uuid[],
    'admin_action'
  )
on conflict (notification_type) do update
set
  is_enabled = excluded.is_enabled,
  primary_recipient_label = excluded.primary_recipient_label,
  internal_copy_role_ids = excluded.internal_copy_role_ids,
  manual_copy_emails = excluded.manual_copy_emails,
  sender_role_ids = excluded.sender_role_ids,
  trigger_type = excluded.trigger_type,
  updated_at = now();

insert into email_templates (template_type, language, subject, body)
values
  ('guide_invitation', 'english', 'You are invited to Tour Guide Operations', 'Hello {{guide_name}}, you have been invited to access Tour Guide Operations.'),
  ('guide_invitation', 'french', 'Invitation a Tour Guide Operations', 'Bonjour {{guide_name}}, vous etes invite a acceder a Tour Guide Operations.'),
  ('guide_invitation', 'spanish', 'Invitacion a Tour Guide Operations', 'Hola {{guide_name}}, has sido invitado a acceder a Tour Guide Operations.'),
  ('guide_invitation', 'turkish', 'Tour Guide Operations daveti', 'Merhaba {{guide_name}}, Tour Guide Operations sistemine davet edildiniz.'),
  ('reset_password', 'english', 'Reset your password', 'Use this link to reset your password: {{reset_link}}'),
  ('reset_password', 'french', 'Reinitialiser votre mot de passe', 'Utilisez ce lien pour reinitialiser votre mot de passe : {{reset_link}}'),
  ('reset_password', 'spanish', 'Restablecer contrasena', 'Usa este enlace para restablecer tu contrasena: {{reset_link}}'),
  ('reset_password', 'turkish', 'Sifrenizi sifirlayin', 'Sifrenizi sifirlamak icin bu baglantiyi kullanin: {{reset_link}}'),
  ('assigned_groups_email', 'english', 'Your assigned groups', 'Hello {{guide_name}}, these are your assigned groups: {{groups_list}}'),
  ('assigned_groups_email', 'french', 'Vos groupes assignes', 'Bonjour {{guide_name}}, voici vos groupes assignes : {{groups_list}}'),
  ('assigned_groups_email', 'spanish', 'Tus grupos asignados', 'Hola {{guide_name}}, estos son tus grupos asignados: {{groups_list}}'),
  ('assigned_groups_email', 'turkish', 'Atanan gruplariniz', 'Merhaba {{guide_name}}, atanan gruplariniz: {{groups_list}}'),
  ('yearly_availability_request', 'english', 'Please submit yearly availability', 'Hello {{guide_name}}, please submit your availability for {{year}}.'),
  ('yearly_availability_request', 'french', 'Veuillez envoyer vos disponibilites annuelles', 'Bonjour {{guide_name}}, veuillez envoyer vos disponibilites pour {{year}}.'),
  ('yearly_availability_request', 'spanish', 'Completa tu disponibilidad anual', 'Hola {{guide_name}}, por favor completa tu disponibilidad para {{year}}.'),
  ('yearly_availability_request', 'turkish', 'Yillik uygunluk talebi', 'Merhaba {{guide_name}}, lutfen {{year}} icin uygunlugunuzu girin.')
on conflict (template_type, language) do update
set
  subject = excluded.subject,
  body = excluded.body,
  updated_at = now();
