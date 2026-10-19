-- ---------------------------------------------------------------------------
-- P2: maintain equipment inventory and unavailability.
--
-- Serialized inventory is changed by activating or retiring labelled units.
-- Rows are retained so reservations and audit evidence never lose their
-- referenced asset. inventory_history records the quantity before and after
-- every type or unavailability change, together with the acting staff member.
-- ---------------------------------------------------------------------------

alter table equipment.equipment_units
  add column status text not null default 'ACTIVE'
    check (status in ('ACTIVE', 'RETIRED'));

create index equipment_units_active_type_idx
  on equipment.equipment_units (equipment_type_id, label)
  where (status = 'ACTIVE');

create table equipment.inventory_history (
  id                 uuid primary key default gen_random_uuid(),
  equipment_type_id  uuid        not null references equipment.equipment_types (id),
  unavailability_id  uuid        references equipment.unavailability (id),
  action             text        not null check (action in ('TYPE_CREATED', 'TYPE_UPDATED', 'UNAVAILABILITY_RECORDED')),
  previous_quantity  int         not null check (previous_quantity >= 0),
  new_quantity       int         not null check (new_quantity >= 0),
  changes            jsonb       not null default '{}'::jsonb check (jsonb_typeof(changes) = 'object'),
  actor_user_id      uuid        not null,
  actor_role         text        not null,
  occurred_at        timestamptz not null default clock_timestamp(),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid
);

create index inventory_history_type_idx
  on equipment.inventory_history (equipment_type_id, occurred_at);
