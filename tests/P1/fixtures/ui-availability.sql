-- Reproducible P1-T14 fixture. Run only in a throwaway database used by your local app.
-- Rerunning resets these exact P1 rows, never the team's inventory.
begin;
delete from equipment.bulk_reservations where equipment_type_id = 'ae111111-0000-0000-0000-000000000014';
delete from equipment.unavailability where equipment_type_id = 'ae111111-0000-0000-0000-000000000014';
delete from equipment.equipment_types where id = 'ae111111-0000-0000-0000-000000000014';
insert into equipment.equipment_types (id, name, description, kind, total_quantity, created_by, updated_by)
values ('ae111111-0000-0000-0000-000000000014', 'P1 Demo Conference Chairs', 'P1 availability browser fixture', 'BULK', 10,
        '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004');
insert into equipment.bulk_reservations (equipment_type_id, event_id, event_reference, quantity, starts_at, ends_at, created_by, updated_by)
values
('ae111111-0000-0000-0000-000000000014', 'ae111111-0000-0000-0000-000000000015', 'EVT-P1-DEMO-A', 4, '2026-12-15T10:00:00Z', '2026-12-15T12:00:00Z', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004'),
('ae111111-0000-0000-0000-000000000014', 'ae111111-0000-0000-0000-000000000016', 'EVT-P1-DEMO-B', 5, '2026-12-15T12:00:00Z', '2026-12-15T14:00:00Z', '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004');
commit;
