-- Seed mock guide availability data.
-- Safe to run after guides, groups, and assignments are seeded.
-- No real personal data, client data, auth records, or sensitive data are seeded here.

delete from availability
where id in (
  '50000000-0000-4000-8000-000000000001',
  '50000000-0000-4000-8000-000000000002',
  '50000000-0000-4000-8000-000000000003',
  '50000000-0000-4000-8000-000000000004',
  '50000000-0000-4000-8000-000000000005',
  '50000000-0000-4000-8000-000000000006',
  '50000000-0000-4000-8000-000000000007',
  '50000000-0000-4000-8000-000000000008',
  '50000000-0000-4000-8000-000000000009',
  '50000000-0000-4000-8000-000000000010'
);

insert into availability (
  id,
  guide_id,
  assignment_id,
  start_date,
  end_date,
  status,
  source,
  notes,
  created_at,
  updated_at
)
values
  (
    '50000000-0000-4000-8000-000000000001',
    '30000000-0000-4000-8000-000000000001',
    null,
    '2026-01-01',
    '2026-12-31',
    'available',
    'guide_submitted',
    'Camille submitted full-year availability for 2026.',
    '2026-06-01 12:00:00+00',
    '2026-06-01 12:00:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    null,
    '2026-08-01',
    '2026-08-10',
    'not_available',
    'guide_submitted',
    'Personal exception inside full-year availability.',
    '2026-06-01 12:05:00+00',
    '2026-06-01 12:05:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000001',
    '41000000-0000-4000-8000-000000000002',
    '2026-06-06',
    '2026-06-12',
    'occupied_by_assignment',
    'assignment_generated',
    'Occupied by seeded Paris group BT-FR-2210.',
    '2026-06-01 12:10:00+00',
    '2026-06-01 12:10:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000002',
    null,
    '2026-01-01',
    '2026-12-31',
    'available',
    'admin_updated',
    'Admin-loaded full-year availability for Istanbul coverage.',
    '2026-06-01 12:15:00+00',
    '2026-06-01 12:15:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003',
    '2026-06-09',
    '2026-06-11',
    'occupied_by_assignment',
    'assignment_generated',
    'Occupied by seeded Istanbul group BT-TR-3197.',
    '2026-06-01 12:20:00+00',
    '2026-06-01 12:20:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000003',
    null,
    '2026-06-01',
    '2026-09-30',
    'pending_review',
    'guide_submitted',
    'Guide submitted partial availability that needs operations review.',
    '2026-06-01 12:25:00+00',
    '2026-06-01 12:25:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000007',
    '30000000-0000-4000-8000-000000000003',
    '41000000-0000-4000-8000-000000000005',
    '2026-06-15',
    '2026-06-19',
    'occupied_by_assignment',
    'assignment_generated',
    'Occupied by seeded Madrid group BT-FR-1405.',
    '2026-06-01 12:30:00+00',
    '2026-06-01 12:30:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000008',
    '30000000-0000-4000-8000-000000000005',
    null,
    '2027-01-01',
    '2027-12-31',
    'available',
    'admin_updated',
    'Daniel is available for full-year 2027 coverage.',
    '2026-06-01 12:35:00+00',
    '2026-06-01 12:35:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000009',
    '30000000-0000-4000-8000-000000000005',
    null,
    '2027-08-15',
    '2027-08-30',
    'not_available',
    'guide_submitted',
    'Summer exception for 2027 conflict testing.',
    '2026-06-01 12:40:00+00',
    '2026-06-01 12:40:00+00'
  ),
  (
    '50000000-0000-4000-8000-000000000010',
    '30000000-0000-4000-8000-000000000004',
    '41000000-0000-4000-8000-000000000006',
    '2026-06-18',
    '2026-06-21',
    'occupied_by_assignment',
    'assignment_generated',
    'Occupied by seeded merged Barcelona group BT-ES-1182.',
    '2026-06-01 12:45:00+00',
    '2026-06-01 12:45:00+00'
  );
