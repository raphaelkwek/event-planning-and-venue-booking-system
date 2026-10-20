-- I2: Venue Staff record periods when a venue can't be used, even when they are
-- already booked (C-12).
--
-- A block never refuses or releases what it overlaps (implementation.md §4.6):
-- each confirmed booking, hold or pending request it disrupts is flagged
-- Requires Reconfirmation and keeps its period. venue.block_disruptions records
-- which block flagged which, who recorded it and when, so removing one block
-- clears a flag only when no other active block still disrupts the same thing.
--
-- A block is removed by status, never deleted (§4.3), keeping who removed it and
-- when. The new checks are added NOT VALID and validated in 0010, in a
-- transaction of their own; every existing block is ACTIVE with these columns null.

alter table venue.unavailability_blocks
  add column removed_by uuid,
  add column removed_at timestamptz;

alter table venue.unavailability_blocks
  add constraint unavailability_blocks_removal_recorded check (
    (status = 'ACTIVE' and removed_by is null and removed_at is null)
    or (status = 'REMOVED' and removed_by is not null and removed_at is not null)
  ) not valid;

-- I2: a pending request a block overlaps is flagged the same way as a booking.
alter table venue.booking_requests
  add column requires_reconfirmation boolean not null default false;

create table venue.block_disruptions (
  id                  uuid primary key default gen_random_uuid(),
  block_id            uuid        not null references venue.unavailability_blocks (id),
  -- A confirmed booking or a hold, or else a pending request: exactly one.
  slot_id             uuid        references venue.venue_slots (id),
  booking_request_id  uuid        references venue.booking_requests (id),
  -- The Venue Staff member who recorded the block, and when.
  created_by          uuid        not null,
  created_at          timestamptz not null default now(),
  constraint block_disruptions_one_target check (num_nonnulls(slot_id, booking_request_id) = 1),
  constraint block_disruptions_slot_once unique (block_id, slot_id),
  constraint block_disruptions_request_once unique (block_id, booking_request_id)
);

-- "Is this booking or request still disrupted by another active block?"
create index block_disruptions_slot_idx on venue.block_disruptions (slot_id) where (slot_id is not null);
create index block_disruptions_request_idx on venue.block_disruptions (booking_request_id) where (booking_request_id is not null);
