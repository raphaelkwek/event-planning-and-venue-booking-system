-- H3 (CR-01): changing a venue's setup or turnaround time flags the bookings
-- and holds that now overlap one another, and removes none of them.
--
-- Each slot keeps the times it was taken with (migration 0003), so the change
-- never rewrites a stored period and the exclusion constraint still holds.
-- Applying the venue's new times to every live slot can still leave two that
-- no longer fit: each is flagged Requires Reconfirmation, as I2 flags a
-- disrupted booking, and venue.buffer_conflicts records which slot now
-- overlaps which, the times that caused it, who changed them and when.
--
-- A later change that makes them fit again clears the record by setting
-- cleared_by and cleared_at; nothing is deleted (implementation.md §4.3). The
-- flag clears with it unless an active I2 block still disrupts the slot, and
-- I2's removal of a block keeps a flag an uncleared conflict still causes.

create table venue.buffer_conflicts (
  id                  uuid primary key default gen_random_uuid(),
  venue_id            uuid        not null references venue.venues (id),
  -- The flagged booking or hold, and one other it now overlaps. A pair that
  -- overlaps is recorded both ways, so each names the other.
  slot_id             uuid        not null references venue.venue_slots (id),
  other_slot_id       uuid        not null references venue.venue_slots (id),
  -- The venue's times that made them overlap.
  setup_minutes       int         not null check (setup_minutes >= 0),
  turnaround_minutes  int         not null check (turnaround_minutes >= 0),
  -- The Venue Staff member who changed the times, and when.
  created_by          uuid        not null,
  created_at          timestamptz not null default now(),
  -- Who changed them again so that the two fit, and when.
  cleared_by          uuid,
  cleared_at          timestamptz,
  constraint buffer_conflicts_two_slots check (slot_id <> other_slot_id),
  constraint buffer_conflicts_clearing_recorded check (num_nonnulls(cleared_by, cleared_at) in (0, 2))
);

-- One uncleared record per pair, so a repeated save records nothing new.
create unique index buffer_conflicts_open_pair_idx
  on venue.buffer_conflicts (slot_id, other_slot_id) where (cleared_at is null);
-- "Which conflicts are open at this venue?" when its times change again.
create index buffer_conflicts_open_venue_idx
  on venue.buffer_conflicts (venue_id) where (cleared_at is null);
