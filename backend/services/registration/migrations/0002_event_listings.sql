-- ---------------------------------------------------------------------------
-- R1: the registration service's own copy of what an attendee may see of each
-- event (ADR-0005). It never reads planning-core's schema: these rows are built
-- from Kafka messages, in the same transaction as their inbox row
-- (registration.consumed_messages), so a redelivery changes nothing twice.
--
-- event_listings comes from event.listing-changed: the event's published
-- fields and registration settings, a snapshot each time. A message older than
-- the one already applied (source_changed_at) is ignored.
--
-- event_venues comes from venue-booking.request-approved (M1), the message the
-- seats are built from: each confirmed booking's venue name, location and
-- layout. A booking an approval replaced (CR-02) is REPLACED and no longer
-- listed.
--
-- Only published fields are kept; internal information never arrives here.
-- ---------------------------------------------------------------------------
create table registration.event_listings (
  id                      uuid primary key default gen_random_uuid(),
  -- planning-core's event.events.id. Another service's id: no foreign key (ADR-0004).
  event_id                uuid        not null unique,
  event_reference         text        not null,
  name                    text        not null,
  description             text,
  -- identity.users.id of the owning organiser (R5 and R7 check it).
  owner_id                uuid        not null,
  -- One of contracts' EVENT_STATUSES, validated on receipt. Not checked here:
  -- a status the event module adds later must not stop this copy updating.
  status                  text        not null,
  starts_at               timestamptz,
  ends_at                 timestamptz,
  registration_required   boolean     not null,
  registration_opens_at   timestamptz,
  registration_closes_at  timestamptz,
  -- R4: null when the organiser set none; withdrawal is then allowed until the start.
  withdrawal_deadline_at  timestamptz,
  -- The changedAt of the message this row was last built from.
  source_changed_at       timestamptz not null,
  created_at              timestamptz not null default now(),
  created_by              uuid,
  updated_at              timestamptz not null default now(),
  updated_by              uuid
);

-- R1's list: Confirmed events with registration, by closing.
create index event_listings_open_idx on registration.event_listings (registration_closes_at)
  where status = 'CONFIRMED' and registration_required;

create table registration.event_venues (
  id               uuid primary key default gen_random_uuid(),
  -- planning-core's event and venue ids, and the confirmed booking's (venue.venue_slots.id). No foreign keys.
  event_id         uuid        not null,
  booking_id       uuid        not null unique,
  venue_id         uuid        not null,
  venue_name       text        not null,
  -- The venue's building or location; null for an approval published before R1.
  venue_location   text,
  layout           text,
  layout_capacity  int,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status           text        not null default 'CONFIRMED' check (status in ('CONFIRMED', 'REPLACED')),
  created_at       timestamptz not null default now(),
  created_by       uuid,
  updated_at       timestamptz not null default now(),
  updated_by       uuid
);

create index event_venues_event_idx on registration.event_venues (event_id) where status = 'CONFIRMED';
