-- S3 (SPM-59): approving a significant change to an event flags the
-- reservations whose period no longer matches the event's Flagged for review.
-- The flag holds back F5's confirmation (AC9); the reservation stays RESERVED
-- and keeps its units and stock.
--
-- equipment.reservation_flags records why: which change request flagged which
-- reservation, the reason shown to the organiser and coordinator (AC8), and
-- the periods compared. Nothing is deleted (§4.3).
--
-- event_id and change_request_id point at rows the event and change modules
-- own: no FK across schemas (§4.1).

alter table equipment.reservations
  add column flagged_for_review boolean not null default false;

create table equipment.reservation_flags (
  id                 uuid primary key default gen_random_uuid(),
  reservation_id     uuid        not null references equipment.reservations (id),
  event_id           uuid        not null,
  change_request_id  uuid        not null,
  flag               text        not null check (flag in ('FLAGGED_FOR_REVIEW')),
  reason             text        not null check (length(btrim(reason)) > 0),
  details            jsonb       not null check (jsonb_typeof(details) = 'object'),
  flagged_at         timestamptz not null default now()
);

-- "Which flags are outstanding on this event?" (AC8) and "why is this reservation flagged?"
create index reservation_flags_event_idx on equipment.reservation_flags (event_id);
create index reservation_flags_reservation_idx on equipment.reservation_flags (reservation_id);
