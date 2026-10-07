-- Reproducible P2 fixture for the reduction-boundary cases P2-T9 and P2-T10.
-- It deliberately uses fixed identifiers that no application seed uses.
begin;

insert into equipment.equipment_types (
  id, name, description, characteristics, kind, total_quantity, created_by, updated_by
) values (
  '22000000-0000-0000-0000-000000000001',
  'P2 Reserved Conference Chair',
  'Bulk stock used by the P2 quantity-reduction cases.',
  '{"material":"Polypropylene","colour":"Black"}'::jsonb,
  'BULK',
  12,
  '00000000-0000-0000-0000-000000000004',
  '00000000-0000-0000-0000-000000000004'
)
on conflict (id) do update set
  name = excluded.name,
  description = excluded.description,
  characteristics = excluded.characteristics,
  kind = excluded.kind,
  total_quantity = excluded.total_quantity,
  updated_at = now(),
  updated_by = excluded.updated_by;

insert into equipment.bulk_reservations (
  id, equipment_type_id, event_id, event_reference, quantity,
  starts_at, ends_at, status, created_by, updated_by
) values
  (
    '22000000-0000-0000-0000-000000000011',
    '22000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000101',
    'EVT-700101',
    6,
    '2026-12-15 10:00:00+08',
    '2026-12-15 12:00:00+08',
    'RESERVED',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004'
  ),
  (
    '22000000-0000-0000-0000-000000000012',
    '22000000-0000-0000-0000-000000000001',
    '22000000-0000-0000-0000-000000000102',
    'EVT-700102',
    4,
    '2026-12-15 10:30:00+08',
    '2026-12-15 11:30:00+08',
    'RESERVED',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000004'
  )
on conflict (id) do update set
  equipment_type_id = excluded.equipment_type_id,
  event_id = excluded.event_id,
  event_reference = excluded.event_reference,
  quantity = excluded.quantity,
  starts_at = excluded.starts_at,
  ends_at = excluded.ends_at,
  status = excluded.status,
  updated_at = now(),
  updated_by = excluded.updated_by;

commit;
