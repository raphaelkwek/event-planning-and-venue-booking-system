-- ---------------------------------------------------------------------------
-- The registration service's schema (EN-13, ADR-0005, implementation.md §4.6).
--
-- One row per seat. A confirmed venue booking creates its seats, and a
-- registration claims a free one with FOR UPDATE SKIP LOCKED, so the number of
-- places is the number of rows and two attendees racing for the last place
-- cannot both get it. Seats sit in a PUBLIC pool and a VIP pool; the organiser
-- sets the VIP pool's size (CQ-01).
--
-- registration.consumed_messages is the inbox (§3.5): a message's id is
-- inserted in the same transaction as the seats it builds, so a duplicate
-- delivery hits the primary key and is skipped.
--
-- Registrations themselves (R2), the waitlist (R6) and the outbox for
-- connectsphere.registration.v1 arrive with those stories, as later migrations.
-- ---------------------------------------------------------------------------
create schema if not exists registration;

create table registration.consumed_messages (
  message_id   uuid primary key,          -- the CloudEvent's id
  consumer     text        not null,
  consumed_at  timestamptz not null default now()
);

create table registration.seats (
  id           uuid primary key default gen_random_uuid(),
  -- The event the seat is for, and the confirmed venue booking that provides it.
  -- Both belong to planning-core: ids only, never a foreign key across the
  -- schema boundary (ADR-0004).
  event_id     uuid        not null,
  booking_id   uuid        not null,
  -- Numbered within its booking, from 1.
  seat_no      int         not null check (seat_no > 0),
  pool         text        not null default 'PUBLIC' check (pool in ('PUBLIC', 'VIP')),
  -- RETIRED: the booking was replaced (CR-02) before anyone claimed this seat.
  status       text        not null default 'FREE' check (status in ('FREE', 'CLAIMED', 'RETIRED')),
  -- identity.users.id of the attendee holding the seat.
  claimed_by   uuid,
  claimed_at   timestamptz,
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  unique (booking_id, seat_no),
  check ((status = 'CLAIMED') = (claimed_by is not null and claimed_at is not null))
);

-- The claim's lookup: the next free seat in a pool, lowest number first.
create index seats_free_idx on registration.seats (event_id, pool, seat_no) where status = 'FREE';
-- Counting an event's seats, and finding a booking's.
create index seats_event_idx on registration.seats (event_id, pool, status);
