-- ---------------------------------------------------------------------------
-- R2 to R4: attendees' registrations. Nothing is deleted (implementation.md
-- §4.3): a withdrawal (R4) and the event's cancellation (R3, F4) are statuses,
-- each with its time.
--
-- A registration holds one seat (registration.seats, EN-13). R2 claims the
-- seat with FOR UPDATE SKIP LOCKED and inserts the registration in the same
-- transaction, so the number of places is the number of seats and two
-- attendees racing for the last one cannot both get it (ADR-0005). R4 frees
-- the seat in the same transaction as the withdrawal; the registration keeps
-- seat_id as a record of the place it held.
--
-- For R7 (manual additions, D-01): seat_id is nullable so an addition above
-- capacity, which has no seat, can be recorded. R7 adds who added it, why, and
-- the over-capacity flag in its own migration, and must hand a seat freed by a
-- withdrawal to an active registration without one before it becomes free, so
-- a free seat always means a place an attendee can take.
-- ---------------------------------------------------------------------------
create sequence registration.registration_reference_seq;

create table registration.registrations (
  id             uuid primary key default gen_random_uuid(),
  -- REG- and six digits: what the attendee is shown, and refusals name (R2).
  reference      text        not null unique
                 default 'REG-' || lpad(nextval('registration.registration_reference_seq')::text, 6, '0'),
  -- planning-core's event, and identity.users.id of the attendee. Other services' ids: no foreign keys.
  event_id       uuid        not null,
  attendee_id    uuid        not null,
  seat_id        uuid        references registration.seats (id),
  status         text        not null default 'REGISTERED' check (status in ('REGISTERED', 'WITHDRAWN', 'CANCELLED')),
  registered_at  timestamptz not null default now(),
  withdrawn_at   timestamptz,
  cancelled_at   timestamptz,
  created_at     timestamptz not null default now(),
  created_by     uuid,
  updated_at     timestamptz not null default now(),
  updated_by     uuid,
  constraint registrations_withdrawn_has_time check ((status = 'WITHDRAWN') = (withdrawn_at is not null)),
  constraint registrations_cancelled_has_time check ((status = 'CANCELLED') = (cancelled_at is not null))
);

-- R2: an attendee holds at most one active registration per event. A second
-- insert raises 23505, which R2 turns into the refusal naming the first.
-- Registering again after withdrawing (R4) is allowed: the old row is Withdrawn.
create unique index registrations_one_active_per_attendee
  on registration.registrations (event_id, attendee_id) where status = 'REGISTERED';

-- A seat is held by at most one active registration.
create unique index registrations_one_active_per_seat
  on registration.registrations (seat_id) where status = 'REGISTERED';

-- R3: an attendee's registrations, newest first.
create index registrations_attendee_idx on registration.registrations (attendee_id, registered_at desc, id desc);

-- Counting an event's registrations, and cancelling them with the event (R3).
create index registrations_event_idx on registration.registrations (event_id, status);
