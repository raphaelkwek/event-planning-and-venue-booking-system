-- ---------------------------------------------------------------------------
-- R6: the waitlist. An attendee refused for capacity may wait for a place.
-- Promotion is not automatic: when a place opens, every waiting attendee is
-- told (waitlist.place-opened), and the first to register through R2 gets it.
--
-- Nothing is deleted (implementation.md §4.3). An entry is WAITLISTED while it
-- waits, then one of:
--   REGISTERED  the attendee registered (R2) or was added (R7); the entry
--               names the registration, in the same transaction;
--   WITHDRAWN   the attendee left; later openings don't reach them;
--   CANCELLED   the event was cancelled, and the attendee was told.
--
-- One waiting entry per attendee and event (the partial unique index). That an
-- attendee never waits while registered is kept by the service: joining,
-- registering and adding each take the attendee's advisory lock and check the
-- other table, and registering ends the entry in the same transaction.
-- ---------------------------------------------------------------------------
create sequence registration.waitlist_reference_seq;

create table registration.waitlist_entries (
  id                uuid primary key default gen_random_uuid(),
  -- WL- and six digits: what the attendee is shown, and a duplicate refusal names.
  reference         text        not null unique
                    default 'WL-' || lpad(nextval('registration.waitlist_reference_seq')::text, 6, '0'),
  -- planning-core's event, and identity.users.id of the attendee. Other services' ids: no foreign keys.
  event_id          uuid        not null,
  attendee_id       uuid        not null,
  status            text        not null default 'WAITLISTED'
                    check (status in ('WAITLISTED', 'REGISTERED', 'WITHDRAWN', 'CANCELLED')),
  -- The order of the waitlist (R6): by joined_at, then id.
  joined_at         timestamptz not null default now(),
  -- When the entry was last told that a place opened; null if never.
  last_notified_at  timestamptz,
  registration_id   uuid        references registration.registrations (id),
  registered_at     timestamptz,
  withdrawn_at      timestamptz,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  created_by        uuid,
  updated_at        timestamptz not null default now(),
  updated_by        uuid,
  constraint waitlist_registered_has_registration
    check ((status = 'REGISTERED') = (registration_id is not null and registered_at is not null)),
  constraint waitlist_withdrawn_has_time check ((status = 'WITHDRAWN') = (withdrawn_at is not null)),
  constraint waitlist_cancelled_has_time check ((status = 'CANCELLED') = (cancelled_at is not null))
);

-- R6: one waiting entry per attendee and event. A second insert raises 23505, refused naming the first.
create unique index waitlist_one_waiting_per_attendee
  on registration.waitlist_entries (event_id, attendee_id) where status = 'WAITLISTED';

-- The organiser's waitlist, in the order it was joined, and the waiting entries to tell of an opening.
create index waitlist_event_order_idx on registration.waitlist_entries (event_id, joined_at, id);

-- The attendee's own entries, newest first.
create index waitlist_attendee_idx on registration.waitlist_entries (attendee_id, joined_at desc, id desc);
