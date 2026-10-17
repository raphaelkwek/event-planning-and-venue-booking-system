-- L1, L2: venue booking requests.
--
-- A request doesn't reserve the venue. Two events may ask for the same venue
-- and period; Venue Staff decide (M1, M2), and approval is where a confirmed
-- booking is created in venue_slots and double-booking is refused (N1). So a
-- request is its own record, not a slot.
--
-- What a request may not overlap is another pending request of the same event
-- for the same venue (L1). The exclusion constraint decides that, so two
-- simultaneous submissions can't both pass a check made first (ADR-0006).
-- Periods are '[)': 14:00-18:00 and 18:00-20:00 only touch.

create sequence venue.booking_request_reference_seq;

create table venue.booking_requests (
  id                      uuid primary key default gen_random_uuid(),
  -- BKR- and six digits, shown to coordinators and Venue Staff.
  reference               text        not null unique
                            default 'BKR-' || lpad(nextval('venue.booking_request_reference_seq')::text, 6, '0'),
  -- event.events.id, owned by the event module: no FK across schemas (§4.1).
  event_id                uuid        not null,
  venue_id                uuid        not null references venue.venues (id),
  starts_at               timestamptz not null,
  ends_at                 timestamptz not null,
  period                  tstzrange   generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  layout                  text        not null check (length(btrim(layout)) > 0),
  expected_attendance     integer     not null check (expected_attendance > 0),
  facilities              text[]      not null default '{}',
  accessibility_features  text[]      not null default '{}',
  -- The event's date, times and attendance when the request was made, so Venue
  -- Staff see what a differing request differs from (L1).
  event_starts_at         timestamptz not null,
  event_ends_at           timestamptz not null,
  event_attendance        integer     not null,
  differs_from_event      boolean     not null,
  -- CR-02 (L5): the disrupted confirmed booking this request would replace.
  replaces_booking_id     uuid        references venue.venue_slots (id),
  status                  text        not null default 'PENDING'
                            check (status in ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN')),
  requested_by            uuid        not null,
  requested_at            timestamptz not null default now(),
  -- L2: who withdrew it, and when. The record is kept.
  withdrawn_by            uuid,
  withdrawn_at            timestamptz,
  created_at              timestamptz not null default now(),
  created_by              uuid,
  updated_at              timestamptz not null default now(),
  updated_by              uuid,
  constraint booking_requests_ends_after_start check (ends_at > starts_at),
  constraint booking_requests_withdrawal_recorded
    check (status <> 'WITHDRAWN' or (withdrawn_by is not null and withdrawn_at is not null)),
  constraint booking_request_no_duplicate_pending
    exclude using gist (event_id with =, venue_id with =, period with &&)
    where (status = 'PENDING')
);

-- The Venue Staff queue (pending requests for their venues) and the calendar
-- (pending requests overlapping a day, with &&).
create index booking_requests_pending_period_idx
  on venue.booking_requests using gist (venue_id, period)
  where (status = 'PENDING');

-- An event's requests (L1's list, L4).
create index booking_requests_event_idx on venue.booking_requests (event_id);
