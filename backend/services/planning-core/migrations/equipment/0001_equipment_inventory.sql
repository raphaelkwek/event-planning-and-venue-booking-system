-- ---------------------------------------------------------------------------
-- Equipment inventory and reservations (EN-02.2, ADR-0006, implementation.md
-- §4.6). Owned by planning-core's equipment module (ADR-0004).
--
-- This replaces the old availability counter, which had no dates: equipment
-- booked in December blocked it in October. Availability is now a question
-- about a period.
--
-- * Serialized equipment (a projector) has one row per unit in
--   equipment_units. A unit_reservations row claims one unit for a period, and
--   a per-unit exclusion constraint refuses a second overlapping claim (Q1).
-- * Bulk stock (chairs) has a total_quantity on its type. A bulk_reservations
--   row takes a quantity for a period. The repo takes the type's row lock, then
--   checks peak concurrent use in the window before inserting (§4.6).
-- * equipment.unavailability marks one unit, or a quantity of bulk stock,
--   out of service for a period, with a reason (P2).
--
-- Composite foreign keys on (type, kind) keep units on serialized types and
-- bulk reservations on bulk types. Nothing is deleted: reservations are
-- RELEASED and unavailability REMOVED (§4.3).
-- ---------------------------------------------------------------------------
create extension if not exists btree_gist;

create schema if not exists equipment;

create table equipment.equipment_types (
  id               uuid primary key default gen_random_uuid(),
  name             text        not null check (length(btrim(name)) > 0),
  description      text        not null default '',
  -- P2's technical characteristics, as name/value pairs.
  characteristics  jsonb       not null default '{}'::jsonb check (jsonb_typeof(characteristics) = 'object'),
  kind             text        not null check (kind in ('SERIALIZED', 'BULK')),
  -- Bulk stock only. A serialized type's total is the number of its units.
  total_quantity   int         check (total_quantity >= 0),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  constraint equipment_types_total_only_for_bulk check ((kind = 'BULK') = (total_quantity is not null)),
  constraint equipment_types_id_kind_key unique (id, kind)
);

create table equipment.equipment_units (
  id                 uuid primary key default gen_random_uuid(),
  equipment_type_id  uuid        not null,
  kind               text        not null default 'SERIALIZED' check (kind = 'SERIALIZED'),
  -- The asset tag on the unit, such as PROJ-01.
  label              text        not null check (length(btrim(label)) > 0),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  foreign key (equipment_type_id, kind) references equipment.equipment_types (id, kind),
  constraint equipment_units_type_label_key unique (equipment_type_id, label),
  constraint equipment_units_id_type_key unique (id, equipment_type_id)
);

create table equipment.unit_reservations (
  id               uuid primary key default gen_random_uuid(),
  unit_id          uuid        not null references equipment.equipment_units (id),
  -- event.events.id, owned by the event module: no FK across schemas (§4.1).
  event_id         uuid        not null,
  -- P2's refusal names the events holding reservations.
  event_reference  text        not null check (length(btrim(event_reference)) > 0),
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  period           tstzrange   generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  status           text        not null default 'RESERVED' check (status in ('RESERVED', 'RELEASED')),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid,
  constraint unit_reservations_ends_after_start check (ends_at > starts_at),
  constraint unit_not_double_reserved
    exclude using gist (unit_id with =, period with &&)
    where (status = 'RESERVED')
);

create index unit_reservations_event_idx on equipment.unit_reservations (event_id);

create table equipment.bulk_reservations (
  id                 uuid primary key default gen_random_uuid(),
  equipment_type_id  uuid        not null,
  kind               text        not null default 'BULK' check (kind = 'BULK'),
  -- event.events.id, owned by the event module: no FK across schemas (§4.1).
  event_id           uuid        not null,
  event_reference    text        not null check (length(btrim(event_reference)) > 0),
  quantity           int         not null check (quantity > 0),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  period             tstzrange   generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  status             text        not null default 'RESERVED' check (status in ('RESERVED', 'RELEASED')),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  foreign key (equipment_type_id, kind) references equipment.equipment_types (id, kind),
  constraint bulk_reservations_ends_after_start check (ends_at > starts_at)
);

-- The peak check reads every reserved quantity of a type overlapping a window.
create index bulk_reservations_reserved_period_idx
  on equipment.bulk_reservations using gist (equipment_type_id, period)
  where (status = 'RESERVED');
create index bulk_reservations_event_idx on equipment.bulk_reservations (event_id);

create table equipment.unavailability (
  id                 uuid primary key default gen_random_uuid(),
  equipment_type_id  uuid        not null references equipment.equipment_types (id),
  -- One serialized unit, or a quantity of bulk stock: exactly one of the two.
  unit_id            uuid,
  quantity           int         check (quantity > 0),
  starts_at          timestamptz not null,
  ends_at            timestamptz not null,
  period             tstzrange   generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  reason             text        not null check (length(btrim(reason)) > 0),
  status             text        not null default 'ACTIVE' check (status in ('ACTIVE', 'REMOVED')),
  created_at         timestamptz not null default now(),
  created_by         uuid,
  updated_at         timestamptz not null default now(),
  updated_by         uuid,
  foreign key (unit_id, equipment_type_id) references equipment.equipment_units (id, equipment_type_id),
  constraint unavailability_unit_or_quantity check ((unit_id is null) <> (quantity is null)),
  constraint unavailability_ends_after_start check (ends_at > starts_at)
);

create index unavailability_active_period_idx
  on equipment.unavailability using gist (equipment_type_id, period)
  where (status = 'ACTIVE');
