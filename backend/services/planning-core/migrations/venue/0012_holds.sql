-- ---------------------------------------------------------------------------
-- L3: tentative holds. Numbered 0012 because 0007 to 0010 are M1, N1 and I2's
-- (not merged yet) and 0011 is K2's; the runner applies whatever it hasn't.
--
-- The customer's Week 9 answer (CQ-06): the event's assigned coordinator
-- requests a hold, and Venue Staff of the venue place it, setting its expiry.
-- A request reserves nothing. Placing it inserts a HELD row in
-- venue.venue_slots, so venue_slot_no_overlap (migration 0003) decides who
-- gets the period on its occupied time (H3), first placed first served.
--
--   REQUESTED  asked for; no slot
--   HELD       placed; its slot is HELD
--   CONVERTED  turned into a booking request (L1). The slot stays HELD, under
--              the request's reference, until M1 approves (CONFIRMED) or M2
--              rejects or L2 withdraws (RELEASED): implementation.md §4.6 rule 3
--   RELEASED   released by its coordinator, or by F4 when the event is
--              cancelled. A placed hold's slot is RELEASED with it
--   EXPIRED    L6. The expiry and reminder lead time are stored now; L6
--              expires holds, sends the reminders and extends the expiry
--
-- Every link is from this new table (to venues, slots and booking requests),
-- so no existing table gains a column or a constraint. Nothing is deleted.
-- ---------------------------------------------------------------------------

create sequence venue.hold_reference_seq;

create table venue.holds (
  id                     uuid primary key default gen_random_uuid(),
  -- HLD- and six digits, shown to coordinators and Venue Staff.
  reference              text        not null unique
                           default 'HLD-' || lpad(nextval('venue.hold_reference_seq')::text, 6, '0'),
  -- event.events.id, owned by the event module: no FK across schemas (§4.1).
  event_id               uuid        not null,
  venue_id               uuid        not null references venue.venues (id),
  starts_at              timestamptz not null,
  ends_at                timestamptz not null,
  -- How long before the expiry the coordinator wants reminding (L6). The
  -- coordinator chooses it per hold (Week 9 answer).
  reminder_lead_minutes  int         not null check (reminder_lead_minutes >= 1),
  status                 text        not null default 'REQUESTED'
                           check (status in ('REQUESTED', 'HELD', 'CONVERTED', 'RELEASED', 'EXPIRED')),
  requested_by           uuid        not null,
  requested_at           timestamptz not null default now(),
  -- Set together when Venue Staff place the hold.
  slot_id                uuid        unique references venue.venue_slots (id),
  placed_by              uuid,
  placed_at              timestamptz,
  expires_at             timestamptz,
  converted_request_id   uuid        unique references venue.booking_requests (id),
  converted_by           uuid,
  converted_at           timestamptz,
  released_by            uuid,
  released_at            timestamptz,
  created_at             timestamptz not null default now(),
  created_by             uuid,
  updated_at             timestamptz not null default now(),
  updated_by             uuid,
  constraint holds_ends_after_start check (ends_at > starts_at),
  constraint holds_placement_recorded check (
    (slot_id is null and placed_by is null and placed_at is null and expires_at is null)
    or (slot_id is not null and placed_by is not null and placed_at is not null
        and expires_at is not null and expires_at > placed_at)
  ),
  -- A requested hold has no slot; held, converted and expired ones have one; a
  -- released hold has one only if it had been placed.
  constraint holds_status_matches_placement check (
    (status = 'REQUESTED' and slot_id is null)
    or (status in ('HELD', 'CONVERTED', 'EXPIRED') and slot_id is not null)
    or status = 'RELEASED'
  ),
  constraint holds_conversion_recorded check (
    (status = 'CONVERTED') = (converted_request_id is not null and converted_by is not null and converted_at is not null)
  ),
  constraint holds_release_recorded check (
    (status = 'RELEASED') = (released_by is not null and released_at is not null)
  )
);

-- CR-03: one requested or held hold per event and venue at a time.
create unique index holds_one_live_per_event_and_venue
  on venue.holds (event_id, venue_id)
  where (status in ('REQUESTED', 'HELD'));

-- Venue Staff's queue of requests to place, soonest first.
create index holds_requested_idx on venue.holds (venue_id, starts_at) where (status = 'REQUESTED');

create index holds_event_idx on venue.holds (event_id);
