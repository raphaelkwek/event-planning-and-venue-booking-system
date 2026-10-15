-- Q1 (SPM-50): one row per reservation of a request line. The unit and bulk
-- rows EN-02.2 reserves still carry the period and decide availability; this
-- row groups them, so reserving three projectors is one reservation, and
-- records what Q1 asks for: the line, both quantities and who reserved it.
--
-- reservation_id on the unit and bulk rows is nullable: rows written before
-- Q1 (EN-02 tests, P2) have no parent. Its foreign keys are added NOT VALID
-- and validated in 0006, in its own transaction.
create table equipment.reservations (
  id                 uuid primary key default gen_random_uuid(),
  request_line_id    uuid        not null references equipment.equipment_request_lines (id),
  -- event.events.id, owned by the event module: no FK across schemas (§4.1).
  event_id           uuid        not null,
  event_reference    text        not null check (length(btrim(event_reference)) > 0),
  equipment_type_id  uuid        not null references equipment.equipment_types (id),
  kind               text        not null check (kind in ('SERIALIZED', 'BULK')),
  requested_quantity int         not null check (requested_quantity > 0),
  reserved_quantity  int         not null check (reserved_quantity > 0),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  status             text        not null default 'RESERVED' check (status in ('RESERVED', 'RELEASED')),
  reserved_by        uuid        not null,
  reserved_at        timestamptz not null default clock_timestamp(),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  constraint reservations_reserved_within_requested check (reserved_quantity <= requested_quantity),
  constraint reservations_ends_after_start check (ends_at > starts_at)
);

-- One active reservation per line: a second Reserve on the same line loses here
-- even if both passed the status check.
create unique index reservations_one_active_per_line
  on equipment.reservations (request_line_id) where (status = 'RESERVED');
create index reservations_event_idx on equipment.reservations (event_id);

alter table equipment.unit_reservations add column reservation_id uuid;
alter table equipment.bulk_reservations add column reservation_id uuid;

alter table equipment.unit_reservations
  add constraint unit_reservations_reservation_fkey
  foreign key (reservation_id) references equipment.reservations (id) not valid;
alter table equipment.bulk_reservations
  add constraint bulk_reservations_reservation_fkey
  foreign key (reservation_id) references equipment.reservations (id) not valid;

create index unit_reservations_reservation_idx on equipment.unit_reservations (reservation_id);
create index bulk_reservations_reservation_idx on equipment.bulk_reservations (reservation_id);
