-- H3-T11 (CR-01): a change of setup or turnaround time also flags the pending
-- requests it makes overlap, so venue.buffer_conflicts records a request as
-- well as a booking or hold, on either side of a pair.
--
-- Each side is a slot or a request, exactly one, as in venue.block_disruptions
-- (migration 0009). The flag itself is booking_requests.requires_reconfirmation,
-- which I2 already sets.
--
-- The foreign keys and checks are added NOT VALID and validated in 0017, in a
-- transaction of their own. Every existing row has a slot on both sides and the
-- new columns null, so validation finds nothing to refuse.

-- A side may now be a request, so its slot column may be null. Only the venue
-- module reads this table, and it reads both kinds from this change on.
-- squawk-ignore ban-drop-not-null
alter table venue.buffer_conflicts alter column slot_id drop not null;
-- squawk-ignore ban-drop-not-null
alter table venue.buffer_conflicts alter column other_slot_id drop not null;

alter table venue.buffer_conflicts
  add column booking_request_id uuid,
  add column other_booking_request_id uuid;

alter table venue.buffer_conflicts
  add constraint buffer_conflicts_booking_request_fkey
    foreign key (booking_request_id) references venue.booking_requests (id) not valid;

alter table venue.buffer_conflicts
  add constraint buffer_conflicts_other_booking_request_fkey
    foreign key (other_booking_request_id) references venue.booking_requests (id) not valid;

alter table venue.buffer_conflicts
  add constraint buffer_conflicts_one_flagged
    check (num_nonnulls(slot_id, booking_request_id) = 1) not valid;

alter table venue.buffer_conflicts
  add constraint buffer_conflicts_one_other
    check (num_nonnulls(other_slot_id, other_booking_request_id) = 1) not valid;

alter table venue.buffer_conflicts
  add constraint buffer_conflicts_two_items
    check (coalesce(slot_id, booking_request_id) <> coalesce(other_slot_id, other_booking_request_id)) not valid;

-- One uncleared record per pair, whichever kind each side is. It replaces
-- 0013's index on the two slot columns, which a null on either side escapes.
create unique index buffer_conflicts_open_items_idx
  on venue.buffer_conflicts (coalesce(slot_id, booking_request_id), coalesce(other_slot_id, other_booking_request_id))
  where (cleared_at is null);

drop index venue.buffer_conflicts_open_pair_idx;

-- "Is this request still in an open conflict?" when an I2 block is removed.
create index buffer_conflicts_open_request_idx
  on venue.buffer_conflicts (booking_request_id) where (cleared_at is null and booking_request_id is not null);
