-- H3-T11: validates 0016's foreign keys and checks in a transaction of their own.
alter table venue.buffer_conflicts validate constraint buffer_conflicts_booking_request_fkey;
alter table venue.buffer_conflicts validate constraint buffer_conflicts_other_booking_request_fkey;
alter table venue.buffer_conflicts validate constraint buffer_conflicts_one_flagged;
alter table venue.buffer_conflicts validate constraint buffer_conflicts_one_other;
alter table venue.buffer_conflicts validate constraint buffer_conflicts_two_items;
