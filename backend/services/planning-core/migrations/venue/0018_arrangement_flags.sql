-- S3 (SPM-59): approving a significant change to an event flags the confirmed
-- bookings it affects. A booking whose period no longer matches the event's is
-- flagged Requires Reconfirmation (the column I2 already sets); one whose
-- booked layout no longer holds the expected attendance is flagged Unsuitable.
-- Either flag holds back F5's confirmation (AC9). Like Requires
-- Reconfirmation, Unsuitable is a flag, never a status (ADR-0006): the booking
-- stays CONFIRMED and keeps its period.
--
-- venue.arrangement_flags records why: which change request flagged which
-- booking, the reason shown to the organiser and coordinator (AC8), and the
-- values compared. Nothing is deleted (§4.3).
--
-- event_id and change_request_id point at rows the event and change modules
-- own: no FK across schemas (§4.1).

alter table venue.venue_slots
  add column unsuitable boolean not null default false;

create table venue.arrangement_flags (
  id                 uuid primary key default gen_random_uuid(),
  slot_id            uuid        not null references venue.venue_slots (id),
  event_id           uuid        not null,
  change_request_id  uuid        not null,
  flag               text        not null check (flag in ('REQUIRES_RECONFIRMATION', 'UNSUITABLE')),
  reason             text        not null check (length(btrim(reason)) > 0),
  details            jsonb       not null check (jsonb_typeof(details) = 'object'),
  flagged_at         timestamptz not null default now()
);

-- "Which flags are outstanding on this event?" (AC8) and "why is this booking flagged?"
create index arrangement_flags_event_idx on venue.arrangement_flags (event_id);
create index arrangement_flags_slot_idx on venue.arrangement_flags (slot_id);
