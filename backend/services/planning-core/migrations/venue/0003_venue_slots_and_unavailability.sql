-- ---------------------------------------------------------------------------
-- Venue slots and unavailability blocks (EN-02.1, ADR-0006, implementation.md
-- §4.4 to §4.6). Numbered 0003 because H3's setup and turnaround columns on
-- venue.venues take 0002; nothing here depends on them.
--
-- venue.venue_slots holds every hold and confirmed booking, one row per venue
-- and period, so a single exclusion constraint keeps them from overlapping
-- (N1, L3, M1). It compares the *occupied* period, the event's own period
-- widened by setup before it and turnaround after it (H3, CR-01). Each slot
-- copies the venue's two times when it is taken, so changing a venue's times
-- never rewrites a stored period: H3 flags the bookings that now conflict.
--
-- Requires Reconfirmation is a flag, never a status (ADR-0006): a flagged
-- booking stays CONFIRMED and keeps blocking its period. RELEASED and EXPIRED
-- slots block nothing. Nothing is deleted (§4.3).
--
-- Holds (L3) and booking requests (L1) are Sprint 3 stories. Their tables will
-- point at their slot, so a hold that becomes a request keeps the same row,
-- still HELD, until M1 or M2 decides (§4.6 rule 3).
--
-- venue.unavailability_blocks holds I2's periods when a venue can't be used.
-- A block doesn't refuse an overlapping booking; I2 flags the booking instead.
-- ---------------------------------------------------------------------------
create extension if not exists btree_gist;

-- [start − setup, end + turnaround). A generated column may only call
-- immutable functions. Postgres marks `timestamptz ± interval` as merely
-- stable, because adding days or months depends on the time zone; adding
-- whole minutes doesn't, so this function is immutable in fact.
create function venue.occupied_period(
  starts_at          timestamptz,
  ends_at            timestamptz,
  setup_minutes      int,
  turnaround_minutes int
) returns tstzrange
language sql
immutable
parallel safe
as $$
  select tstzrange(
    starts_at - make_interval(mins => setup_minutes),
    ends_at + make_interval(mins => turnaround_minutes),
    '[)'
  )
$$;

create table venue.venue_slots (
  id                       uuid primary key default gen_random_uuid(),
  venue_id                 uuid        not null references venue.venues (id),
  -- event.events.id, owned by the event module: no FK across schemas (§4.1).
  -- One event can hold slots at several venues (CR-03).
  event_id                 uuid        not null,
  -- The hold's or booking request's reference, which refusals and the
  -- calendar show (I1, N1).
  reference                text        not null check (length(btrim(reference)) > 0),
  starts_at                timestamptz not null,
  ends_at                  timestamptz not null,
  -- The venue's setup and turnaround time when the slot was taken (H3).
  setup_minutes            int         not null default 0 check (setup_minutes >= 0),
  turnaround_minutes       int         not null default 0 check (turnaround_minutes >= 0),
  period                   tstzrange   generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  blocked_period           tstzrange   generated always as
                             (venue.occupied_period(starts_at, ends_at, setup_minutes, turnaround_minutes)) stored,
  status                   text        not null check (status in ('HELD', 'CONFIRMED', 'RELEASED', 'EXPIRED')),
  requires_reconfirmation  boolean     not null default false,
  created_at               timestamptz not null default now(),
  created_by               uuid,
  updated_at               timestamptz not null default now(),
  updated_by               uuid,
  constraint venue_slots_ends_after_start check (ends_at > starts_at),
  constraint venue_slot_no_overlap
    exclude using gist (venue_id with =, blocked_period with &&)
    where (status in ('HELD', 'CONFIRMED'))
);

create index venue_slots_event_idx on venue.venue_slots (event_id);

create table venue.unavailability_blocks (
  id           uuid primary key default gen_random_uuid(),
  venue_id     uuid        not null references venue.venues (id),
  starts_at    timestamptz not null,
  ends_at      timestamptz not null,
  period       tstzrange   generated always as (tstzrange(starts_at, ends_at, '[)')) stored,
  reason_type  text        not null check (reason_type in ('MAINTENANCE', 'EQUIPMENT_FAILURE', 'RENOVATION', 'SAFETY', 'OTHER')),
  description  text        not null check (length(btrim(description)) > 0),
  status       text        not null default 'ACTIVE' check (status in ('ACTIVE', 'REMOVED')),
  created_at   timestamptz not null default now(),
  created_by   uuid,
  updated_at   timestamptz not null default now(),
  updated_by   uuid,
  constraint unavailability_blocks_ends_after_start check (ends_at > starts_at)
);

-- The calendar (I1) and search (J1) ask "which active blocks overlap this
-- period at this venue", with && on period.
create index unavailability_blocks_active_period_idx
  on venue.unavailability_blocks using gist (venue_id, period)
  where (status = 'ACTIVE');
