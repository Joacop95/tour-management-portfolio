-- Seed mock guide data and guide circuit capabilities.
-- Safe to run after base circuit seed data.
-- No auth users, profiles, passwords, or real personal emails are seeded here.

alter table guides
  add column if not exists languages supported_language[] null;

insert into guides (
  id,
  full_name,
  authorized_email,
  phone,
  preferred_language,
  languages,
  status,
  internal_notes,
  internal_rating,
  sales_ranking,
  sales_score,
  change_requests_count,
  completed_change_requests_count,
  rejected_change_requests_count,
  pending_change_requests_count,
  created_at,
  updated_at
)
values
  (
    '30000000-0000-4000-8000-000000000001',
    'Camille Laurent',
    'camille.laurent@example.com',
    '+33612345678',
    'french',
    array['french', 'english', 'spanish']::supported_language[],
    'active',
    'Mock guide seeded for Paris and Madrid capability testing.',
    4.80,
    2,
    94.00,
    3,
    2,
    0,
    1,
    '2026-06-01 09:00:00+00',
    '2026-06-01 09:00:00+00'
  ),
  (
    '30000000-0000-4000-8000-000000000002',
    'Emre Yilmaz',
    'emre.yilmaz@example.com',
    '+905321234567',
    'turkish',
    array['turkish', 'english']::supported_language[],
    'active',
    'Mock guide seeded for Istanbul capability testing.',
    4.60,
    5,
    87.00,
    1,
    1,
    0,
    0,
    '2026-06-01 09:00:00+00',
    '2026-06-01 09:00:00+00'
  ),
  (
    '30000000-0000-4000-8000-000000000003',
    'Luc Moreau',
    'luc.moreau@example.com',
    '+33687654321',
    'french',
    array['french', 'spanish']::supported_language[],
    'active',
    'Mock guide seeded for Paris and Madrid coverage.',
    4.40,
    6,
    82.00,
    4,
    2,
    1,
    1,
    '2026-06-01 09:00:00+00',
    '2026-06-01 09:00:00+00'
  ),
  (
    '30000000-0000-4000-8000-000000000004',
    'Sofia Martin',
    'sofia.martin@example.com',
    '+34600111222',
    'spanish',
    array['spanish', 'english']::supported_language[],
    'invited',
    'Mock invited guide for Spain circuits.',
    4.20,
    8,
    76.00,
    0,
    0,
    0,
    0,
    '2026-06-01 09:00:00+00',
    '2026-06-01 09:00:00+00'
  ),
  (
    '30000000-0000-4000-8000-000000000005',
    'Daniel Ortega',
    'daniel.ortega@example.com',
    '+34600999888',
    'spanish',
    array['spanish', 'english', 'french']::supported_language[],
    'active',
    'Mock high-coverage guide for Spanish circuits.',
    4.90,
    1,
    98.00,
    5,
    3,
    1,
    1,
    '2026-06-01 09:00:00+00',
    '2026-06-01 09:00:00+00'
  ),
  (
    '30000000-0000-4000-8000-000000000006',
    'Aylin Demir',
    'aylin.demir@example.com',
    '+905551112233',
    'turkish',
    array['turkish', 'english']::supported_language[],
    'blocked',
    'Mock blocked guide retained for status preview testing.',
    null,
    null,
    null,
    2,
    0,
    2,
    0,
    '2026-06-01 09:00:00+00',
    '2026-06-01 09:00:00+00'
  )
on conflict (authorized_email) do update
set
  full_name = excluded.full_name,
  phone = excluded.phone,
  preferred_language = excluded.preferred_language,
  languages = excluded.languages,
  status = excluded.status,
  internal_notes = excluded.internal_notes,
  internal_rating = excluded.internal_rating,
  sales_ranking = excluded.sales_ranking,
  sales_score = excluded.sales_score,
  change_requests_count = excluded.change_requests_count,
  completed_change_requests_count = excluded.completed_change_requests_count,
  rejected_change_requests_count = excluded.rejected_change_requests_count,
  pending_change_requests_count = excluded.pending_change_requests_count,
  updated_at = now();

insert into guide_circuit_capabilities (
  id,
  guide_id,
  circuit_id,
  is_active,
  notes,
  created_at,
  updated_at
)
values
  ('31000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', true, 'Paris to Loire capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000002', '30000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', true, 'Madrid capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000002', '20000000-0000-4000-8000-000000000003', true, 'Istanbul capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000004', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002', true, 'Paris to Loire capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000005', true, 'Madrid capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000006', '30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000001', true, 'Barcelona capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000007', '30000000-0000-4000-8000-000000000004', '20000000-0000-4000-8000-000000000004', true, 'Andalusia capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000008', '30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000001', true, 'Barcelona capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000009', '30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000004', true, 'Andalusia capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000010', '30000000-0000-4000-8000-000000000005', '20000000-0000-4000-8000-000000000005', true, 'Madrid capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00'),
  ('31000000-0000-4000-8000-000000000011', '30000000-0000-4000-8000-000000000006', '20000000-0000-4000-8000-000000000003', true, 'Istanbul capability from mock guide data.', '2026-06-01 09:00:00+00', '2026-06-01 09:00:00+00')
on conflict (guide_id, circuit_id) do update
set
  is_active = excluded.is_active,
  notes = excluded.notes,
  updated_at = now();
