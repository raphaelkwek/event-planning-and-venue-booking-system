-- S3 (SPM-59): approving a significant change to an event flags the venue
-- arrangements it affects: confirmed bookings, held holds and pending booking
-- requests. One whose period no longer matches the event's is flagged Requires
-- Reconfirmation; one whose layout no longer holds the expected attendance is
-- flagged Unsuitable. Either flag holds back F5's confirmation (AC9). Both are
-- flags, never a status (ADR-0006): the arrangement keeps its status and period.
--
-- S3's Requires Reconfirmation is its own column, period_mismatch, not I2's
-- requires_reconfirmation: I2 and H3 clear that one when their own block or
-- buffer conflict goes, which must not clear a flag an approved change set.
-- F5 reads either column as Requires Reconfirmation.
--
-- A pending request carries its flags until M1 decides it; approving it copies
-- them, and their rows, onto the confirmed booking (api/bookingDecisions.ts).
-- A hold's flags are on its slot, which M1 confirms in place (L3).
--
-- venue.arrangement_flags records why: which change request flagged which
-- booking, hold or request, the reason shown to the organiser and coordinator
-- (AC8), and the values compared. Nothing is deleted (§4.3).
--
-- event_id and change_request_id point at rows the event and change modules
-- own: no FK across schemas (§4.1).

alter table venue.venue_slots
  add column period_mismatch boolean not null default false,
  add column unsuitable boolean not null default false;

alter table venue.booking_requests
  add column period_mismatch boolean not null default false,
  add column unsuitable boolean not null default false;

create table venue.arrangement_flags (
  id                 uuid primary key default gen_random_uuid(),
  -- A booking's or hold's slot, or a pending request: exactly one.
  slot_id            uuid        references venue.venue_slots (id),
  booking_request_id uuid        references venue.booking_requests (id),
  event_id           uuid        not null,
  change_request_id  uuid        not null,
  flag               text        not null check (flag in ('REQUIRES_RECONFIRMATION', 'UNSUITABLE')),
  reason             text        not null check (length(btrim(reason)) > 0),
  details            jsonb       not null check (jsonb_typeof(details) = 'object'),
  flagged_at         timestamptz not null default now(),
  constraint arrangement_flags_one_arrangement check (num_nonnulls(slot_id, booking_request_id) = 1)
);

-- "Which flags are outstanding on this event?" (AC8) and "why is this booking or request flagged?"
create index arrangement_flags_event_idx on venue.arrangement_flags (event_id);
create index arrangement_flags_slot_idx on venue.arrangement_flags (slot_id);
create index arrangement_flags_request_idx on venue.arrangement_flags (booking_request_id);
