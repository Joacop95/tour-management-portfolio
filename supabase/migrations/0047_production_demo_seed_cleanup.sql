-- Historical migrations 0002/0004/0005/0006 seeded demo operations. Remove
-- them only from an untouched fresh-chain database. A populated or edited
-- database skips the entire cleanup; never delete a partially reused graph.
do $$
declare
  v_circuits uuid[] := array[
    '20000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002',
    '20000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000004',
    '20000000-0000-4000-8000-000000000005'
  ]::uuid[];
  v_guides uuid[] := array[
    '30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002',
    '30000000-0000-4000-8000-000000000003', '30000000-0000-4000-8000-000000000004',
    '30000000-0000-4000-8000-000000000005', '30000000-0000-4000-8000-000000000006'
  ]::uuid[];
  v_capabilities uuid[] := array[
    '31000000-0000-4000-8000-000000000001', '31000000-0000-4000-8000-000000000002',
    '31000000-0000-4000-8000-000000000003', '31000000-0000-4000-8000-000000000004',
    '31000000-0000-4000-8000-000000000005', '31000000-0000-4000-8000-000000000006',
    '31000000-0000-4000-8000-000000000007', '31000000-0000-4000-8000-000000000008',
    '31000000-0000-4000-8000-000000000009', '31000000-0000-4000-8000-000000000010',
    '31000000-0000-4000-8000-000000000011'
  ]::uuid[];
  v_groups uuid[] := array[
    '40000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000002',
    '40000000-0000-4000-8000-000000000003', '40000000-0000-4000-8000-000000000004',
    '40000000-0000-4000-8000-000000000005', '40000000-0000-4000-8000-000000000006',
    '40000000-0000-4000-8000-000000000007'
  ]::uuid[];
  v_assignments uuid[] := array[
    '41000000-0000-4000-8000-000000000001', '41000000-0000-4000-8000-000000000002',
    '41000000-0000-4000-8000-000000000003', '41000000-0000-4000-8000-000000000004',
    '41000000-0000-4000-8000-000000000005', '41000000-0000-4000-8000-000000000006',
    '41000000-0000-4000-8000-000000000007'
  ]::uuid[];
  v_availability uuid[] := array[
    '50000000-0000-4000-8000-000000000001', '50000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000003', '50000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000005', '50000000-0000-4000-8000-000000000006',
    '50000000-0000-4000-8000-000000000007', '50000000-0000-4000-8000-000000000008',
    '50000000-0000-4000-8000-000000000009', '50000000-0000-4000-8000-000000000010'
  ]::uuid[];
  v_aliases uuid[] := array[
    '21000000-0000-4000-8000-000000000001', '21000000-0000-4000-8000-000000000002',
    '21000000-0000-4000-8000-000000000003', '21000000-0000-4000-8000-000000000004',
    '21000000-0000-4000-8000-000000000005', '21000000-0000-4000-8000-000000000006',
    '21000000-0000-4000-8000-000000000007', '21000000-0000-4000-8000-000000000008',
    '21000000-0000-4000-8000-000000000009', '21000000-0000-4000-8000-000000000010',
    '21000000-0000-4000-8000-000000000011', '21000000-0000-4000-8000-000000000012',
    '21000000-0000-4000-8000-000000000014', '21000000-0000-4000-8000-000000000015',
    '21000000-0000-4000-8000-000000000016'
  ]::uuid[];
begin
  -- This is a data-state guard, not an environment-name heuristic. Any real
  -- operational row or Auth identity makes the migration a no-op.
  if (select count(*) from public.circuits) <> 26
    or (select count(*) from public.guides) <> 6
    or (select count(*) from public.groups) <> 7
    or (select count(*) from public.assignments) <> 7
    or (select count(*) from public.availability) <> 10
    or (select count(*) from public.guide_circuit_capabilities) <> 11
    or (select count(*) from public.circuit_aliases) <> 15
    or (select count(*) from public.guide_authorized_emails) <> 6
    or exists (select 1 from public.profiles)
    or exists (select 1 from auth.users)
    or exists (select 1 from public.internal_authorized_users)
    or exists (select 1 from public.change_requests)
    or exists (select 1 from public.assignment_notification_outbox)
    or exists (select 1 from public.guide_availability_submissions)
    or exists (select 1 from public.group_code_circuit_mappings where circuit_id = any(v_circuits))
  then
    raise notice 'Historical demo cleanup skipped: database is not the untouched fresh-chain baseline.';
    return;
  end if;

  if (select count(*) from public.circuits c
      where c.id = any(v_circuits) and c.created_at = '2026-06-01 09:00:00+00'
        and c.updated_at = c.created_at and c.is_active and not c.is_archived
        and (c.id::text, c.name, c.code) in (values
          ('20000000-0000-4000-8000-000000000001','Barcelona Essentials','BCN-ESS'),
          ('20000000-0000-4000-8000-000000000002','Paris to Loire','PAR-LOR'),
          ('20000000-0000-4000-8000-000000000003','Istanbul Heritage','IST-HER'),
          ('20000000-0000-4000-8000-000000000004','Andalusia Highlights','AND-HIL'),
          ('20000000-0000-4000-8000-000000000005','Madrid Art Week','MAD-ART'))
     ) <> 5
    or (select count(*) from public.guides g
      where g.id = any(v_guides) and g.created_at = '2026-06-01 09:00:00+00'
        and g.updated_at = g.created_at
        and (g.id::text, g.full_name, g.authorized_email, g.status::text) in (values
          ('30000000-0000-4000-8000-000000000001','Camille Laurent','camille.laurent@example.com','active'),
          ('30000000-0000-4000-8000-000000000002','Emre Yilmaz','emre.yilmaz@example.com','active'),
          ('30000000-0000-4000-8000-000000000003','Luc Moreau','luc.moreau@example.com','active'),
          ('30000000-0000-4000-8000-000000000004','Sofia Martin','sofia.martin@example.com','invited'),
          ('30000000-0000-4000-8000-000000000005','Daniel Ortega','daniel.ortega@example.com','active'),
          ('30000000-0000-4000-8000-000000000006','Aylin Demir','aylin.demir@example.com','blocked'))
     ) <> 6
    or (select count(*) from public.groups g
      where g.id = any(v_groups) and g.created_at = '2026-06-01 10:00:00+00'
        and g.updated_at = g.created_at
        and (g.id::text, g.group_code, g.circuit_id::text, g.group_status::text,
             g.assignment_status::text, g.confirmation_status::text) in (values
          ('40000000-0000-4000-8000-000000000001','BT-ES-1048','20000000-0000-4000-8000-000000000001','active','without_guide','not_required'),
          ('40000000-0000-4000-8000-000000000002','BT-FR-2210','20000000-0000-4000-8000-000000000002','active','assigned','pending_confirmation'),
          ('40000000-0000-4000-8000-000000000003','BT-TR-3197','20000000-0000-4000-8000-000000000003','finalized','assigned','confirmed'),
          ('40000000-0000-4000-8000-000000000004','BT-EN-0872','20000000-0000-4000-8000-000000000004','active','without_guide','not_required'),
          ('40000000-0000-4000-8000-000000000005','BT-FR-1405','20000000-0000-4000-8000-000000000005','active','assigned','pending_confirmation'),
          ('40000000-0000-4000-8000-000000000006','BT-ES-1182','20000000-0000-4000-8000-000000000001','fusionado','assigned','confirmed'),
          ('40000000-0000-4000-8000-000000000007','BT-FR-1930','20000000-0000-4000-8000-000000000002','cxl','without_guide','not_required'))
     ) <> 7
    or (select count(*) from public.assignments a
      where a.id = any(v_assignments) and a.is_current
        and a.updated_at = coalesce(a.confirmed_at, a.created_at)
        and a.assigned_at = a.created_at
        and (a.id::text, a.group_id::text, coalesce(a.guide_id::text,''),
             a.status::text, a.confirmation_status::text) in (values
          ('41000000-0000-4000-8000-000000000001','40000000-0000-4000-8000-000000000001','','without_guide','not_required'),
          ('41000000-0000-4000-8000-000000000002','40000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','assigned','pending_confirmation'),
          ('41000000-0000-4000-8000-000000000003','40000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','assigned','confirmed'),
          ('41000000-0000-4000-8000-000000000004','40000000-0000-4000-8000-000000000004','','without_guide','not_required'),
          ('41000000-0000-4000-8000-000000000005','40000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000003','assigned','pending_confirmation'),
          ('41000000-0000-4000-8000-000000000006','40000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000004','assigned','confirmed'),
          ('41000000-0000-4000-8000-000000000007','40000000-0000-4000-8000-000000000007','','without_guide','not_required'))
     ) <> 7
  then
    raise notice 'Historical demo cleanup skipped: seeded parent or assignment fingerprint changed.';
    return;
  end if;

  if (select count(*) from public.availability a where a.id = any(v_availability)
        and a.updated_at = a.created_at
        and (a.id::text, a.guide_id::text, coalesce(a.assignment_id::text,''),
             a.start_date::text, a.end_date::text, a.status::text, a.source::text) in (values
          ('50000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','','2026-01-01','2026-12-31','available','guide_submitted'),
          ('50000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','','2026-08-01','2026-08-10','not_available','guide_submitted'),
          ('50000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000002','2026-06-06','2026-06-12','occupied_by_assignment','assignment_generated'),
          ('50000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000002','','2026-01-01','2026-12-31','available','admin_updated'),
          ('50000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000002','41000000-0000-4000-8000-000000000003','2026-06-09','2026-06-11','occupied_by_assignment','assignment_generated'),
          ('50000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000003','','2026-06-01','2026-09-30','pending_review','guide_submitted'),
          ('50000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000003','41000000-0000-4000-8000-000000000005','2026-06-15','2026-06-19','occupied_by_assignment','assignment_generated'),
          ('50000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000005','','2027-01-01','2027-12-31','available','admin_updated'),
          ('50000000-0000-4000-8000-000000000009','30000000-0000-4000-8000-000000000005','','2027-08-15','2027-08-30','not_available','guide_submitted'),
          ('50000000-0000-4000-8000-000000000010','30000000-0000-4000-8000-000000000004','41000000-0000-4000-8000-000000000006','2026-06-18','2026-06-21','occupied_by_assignment','assignment_generated'))
     ) <> 10
    or (select count(*) from public.guide_circuit_capabilities c
      where c.id = any(v_capabilities) and c.updated_at = c.created_at
        and (c.id::text, c.guide_id::text, c.circuit_id::text) in (values
          ('31000000-0000-4000-8000-000000000001','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000002'),
          ('31000000-0000-4000-8000-000000000002','30000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000005'),
          ('31000000-0000-4000-8000-000000000003','30000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000003'),
          ('31000000-0000-4000-8000-000000000004','30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000002'),
          ('31000000-0000-4000-8000-000000000005','30000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000005'),
          ('31000000-0000-4000-8000-000000000006','30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001'),
          ('31000000-0000-4000-8000-000000000007','30000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000004'),
          ('31000000-0000-4000-8000-000000000008','30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000001'),
          ('31000000-0000-4000-8000-000000000009','30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000004'),
          ('31000000-0000-4000-8000-000000000010','30000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000005'),
          ('31000000-0000-4000-8000-000000000011','30000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000003'))
     ) <> 11
    or (select count(*) from public.circuit_aliases a
      where a.id = any(v_aliases) and a.updated_at = a.created_at
        and (a.id::text, a.circuit_id::text, a.alias) in (values
          ('21000000-0000-4000-8000-000000000001','20000000-0000-4000-8000-000000000001','BARCELONA'),
          ('21000000-0000-4000-8000-000000000002','20000000-0000-4000-8000-000000000001','BCN'),
          ('21000000-0000-4000-8000-000000000003','20000000-0000-4000-8000-000000000001','BCN ESSENTIALS'),
          ('21000000-0000-4000-8000-000000000004','20000000-0000-4000-8000-000000000001','Barcelona Essentials'),
          ('21000000-0000-4000-8000-000000000005','20000000-0000-4000-8000-000000000002','PARIS LOIRE'),
          ('21000000-0000-4000-8000-000000000006','20000000-0000-4000-8000-000000000002','Paris-Loire'),
          ('21000000-0000-4000-8000-000000000007','20000000-0000-4000-8000-000000000002','Paris to Loire'),
          ('21000000-0000-4000-8000-000000000008','20000000-0000-4000-8000-000000000003','ISTANBUL'),
          ('21000000-0000-4000-8000-000000000009','20000000-0000-4000-8000-000000000003','ISTANBUL HERITAGE'),
          ('21000000-0000-4000-8000-000000000010','20000000-0000-4000-8000-000000000003','Estambul'),
          ('21000000-0000-4000-8000-000000000011','20000000-0000-4000-8000-000000000004','ANDALUSIA'),
          ('21000000-0000-4000-8000-000000000012','20000000-0000-4000-8000-000000000004','Andalucia Highlights'),
          ('21000000-0000-4000-8000-000000000014','20000000-0000-4000-8000-000000000004','Andalusia Highlights'),
          ('21000000-0000-4000-8000-000000000015','20000000-0000-4000-8000-000000000005','MADRID ART'),
          ('21000000-0000-4000-8000-000000000016','20000000-0000-4000-8000-000000000005','MADRID ART WEEK'))
     ) <> 15
    or (select count(*) from public.guide_authorized_emails e
      join public.guides g on g.id = e.guide_id
      where e.guide_id = any(v_guides) and e.email = g.authorized_email
        and e.source = 'migration' and e.profile_id is null
        and e.status = case when g.status = 'invited' then 'invited' else 'allowed' end) <> 6
  then
    raise notice 'Historical demo cleanup skipped: seeded child or authorization fingerprint changed.';
    return;
  end if;

  delete from public.guide_authorized_emails where guide_id = any(v_guides);
  delete from public.availability where id = any(v_availability);
  delete from public.assignments where id = any(v_assignments);
  delete from public.groups where id = any(v_groups);
  delete from public.guide_circuit_capabilities where id = any(v_capabilities);
  delete from public.guides where id = any(v_guides);
  delete from public.circuit_aliases where id = any(v_aliases);
  delete from public.circuits where id = any(v_circuits);

  if (select count(*) from public.circuits) <> 21
    or exists (select 1 from public.guides)
    or exists (select 1 from public.groups)
    or exists (select 1 from public.assignments)
    or exists (select 1 from public.availability)
    or exists (select 1 from public.guide_authorized_emails)
  then
    raise exception 'Historical demo cleanup did not produce the expected fresh operational state.';
  end if;
  raise notice 'Historical demo operational seeds removed from fresh database.';
end;
$$;
