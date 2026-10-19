-- Seed mock group data and current assignment rows.
-- Safe to run after guides, circuits, and guide capabilities are seeded.
-- No real passenger names, client data, profiles, auth records, or sensitive data are seeded here.

delete from assignments
where group_id in (
  '40000000-0000-4000-8000-000000000001',
  '40000000-0000-4000-8000-000000000002',
  '40000000-0000-4000-8000-000000000003',
  '40000000-0000-4000-8000-000000000004',
  '40000000-0000-4000-8000-000000000005',
  '40000000-0000-4000-8000-000000000006',
  '40000000-0000-4000-8000-000000000007'
);

insert into groups (
  id,
  group_code,
  circuit_id,
  start_date,
  end_date,
  group_status,
  assignment_status,
  confirmation_status,
  estimated_passengers,
  internal_notes,
  created_at,
  updated_at
)
values
  (
    '40000000-0000-4000-8000-000000000001',
    'BT-ES-1048',
    '20000000-0000-4000-8000-000000000001',
    '2026-06-04',
    '2026-06-07',
    'active',
    'without_guide',
    'not_required',
    18,
    'Mock unassigned Barcelona group.',
    '2026-06-01 10:00:00+00',
    '2026-06-01 10:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000002',
    'BT-FR-2210',
    '20000000-0000-4000-8000-000000000002',
    '2026-06-06',
    '2026-06-12',
    'active',
    'assigned',
    'pending_confirmation',
    24,
    'Mock Paris group pending guide confirmation.',
    '2026-06-01 10:00:00+00',
    '2026-06-01 10:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000003',
    'BT-TR-3197',
    '20000000-0000-4000-8000-000000000003',
    '2026-06-09',
    '2026-06-11',
    'finalized',
    'assigned',
    'confirmed',
    16,
    'Mock finalized Istanbul group.',
    '2026-06-01 10:00:00+00',
    '2026-06-01 10:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000004',
    'BT-EN-0872',
    '20000000-0000-4000-8000-000000000004',
    '2026-06-12',
    '2026-06-18',
    'active',
    'without_guide',
    'not_required',
    31,
    'Mock unassigned Andalusia group.',
    '2026-06-01 10:00:00+00',
    '2026-06-01 10:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000005',
    'BT-FR-1405',
    '20000000-0000-4000-8000-000000000005',
    '2026-06-15',
    '2026-06-19',
    'active',
    'assigned',
    'pending_confirmation',
    20,
    'Mock Madrid group pending guide confirmation.',
    '2026-06-01 10:00:00+00',
    '2026-06-01 10:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000006',
    'BT-ES-1182',
    '20000000-0000-4000-8000-000000000001',
    '2026-06-18',
    '2026-06-21',
    'fusionado',
    'assigned',
    'confirmed',
    12,
    'Mock merged group with confirmed guide.',
    '2026-06-01 10:00:00+00',
    '2026-06-01 10:00:00+00'
  ),
  (
    '40000000-0000-4000-8000-000000000007',
    'BT-FR-1930',
    '20000000-0000-4000-8000-000000000002',
    '2026-06-22',
    '2026-06-28',
    'cxl',
    'without_guide',
    'not_required',
    0,
    'Mock cancelled group without guide.',
    '2026-06-01 10:00:00+00',
    '2026-06-01 10:00:00+00'
  )
on conflict (group_code) do update
set
  circuit_id = excluded.circuit_id,
  start_date = excluded.start_date,
  end_date = excluded.end_date,
  group_status = excluded.group_status,
  assignment_status = excluded.assignment_status,
  confirmation_status = excluded.confirmation_status,
  estimated_passengers = excluded.estimated_passengers,
  internal_notes = excluded.internal_notes,
  updated_at = now();

insert into assignments (
  id,
  group_id,
  guide_id,
  status,
  confirmation_status,
  assigned_at,
  confirmed_at,
  is_current,
  notes,
  created_at,
  updated_at
)
values
  (
    '41000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000001',
    null,
    'without_guide',
    'not_required',
    '2026-06-01 10:00:00+00',
    null,
    true,
    'Current mock assignment state: no guide assigned.',
    '2026-06-01 10:00:00+00',
    '2026-06-01 10:00:00+00'
  ),
  (
    '41000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000001',
    'assigned',
    'pending_confirmation',
    '2026-06-01 10:05:00+00',
    null,
    true,
    'Current mock assignment pending confirmation.',
    '2026-06-01 10:05:00+00',
    '2026-06-01 10:05:00+00'
  ),
  (
    '41000000-0000-4000-8000-000000000003',
    '40000000-0000-4000-8000-000000000003',
    '30000000-0000-4000-8000-000000000002',
    'assigned',
    'confirmed',
    '2026-06-01 10:10:00+00',
    '2026-06-01 11:00:00+00',
    true,
    'Current mock confirmed assignment.',
    '2026-06-01 10:10:00+00',
    '2026-06-01 11:00:00+00'
  ),
  (
    '41000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000004',
    null,
    'without_guide',
    'not_required',
    '2026-06-01 10:15:00+00',
    null,
    true,
    'Current mock assignment state: no guide assigned.',
    '2026-06-01 10:15:00+00',
    '2026-06-01 10:15:00+00'
  ),
  (
    '41000000-0000-4000-8000-000000000005',
    '40000000-0000-4000-8000-000000000005',
    '30000000-0000-4000-8000-000000000003',
    'assigned',
    'pending_confirmation',
    '2026-06-01 10:20:00+00',
    null,
    true,
    'Current mock assignment pending confirmation.',
    '2026-06-01 10:20:00+00',
    '2026-06-01 10:20:00+00'
  ),
  (
    '41000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000006',
    '30000000-0000-4000-8000-000000000004',
    'assigned',
    'confirmed',
    '2026-06-01 10:25:00+00',
    '2026-06-01 11:05:00+00',
    true,
    'Current mock confirmed assignment.',
    '2026-06-01 10:25:00+00',
    '2026-06-01 11:05:00+00'
  ),
  (
    '41000000-0000-4000-8000-000000000007',
    '40000000-0000-4000-8000-000000000007',
    null,
    'without_guide',
    'not_required',
    '2026-06-01 10:30:00+00',
    null,
    true,
    'Current mock assignment state: cancelled group without guide.',
    '2026-06-01 10:30:00+00',
    '2026-06-01 10:30:00+00'
  );
