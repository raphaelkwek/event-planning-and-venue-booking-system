-- M1, M2: validates 0007's foreign key and checks in a transaction of their own.
alter table venue.booking_requests validate constraint booking_requests_booking_fkey;
alter table venue.booking_requests validate constraint booking_requests_decision_recorded;
alter table venue.venue_slots validate constraint venue_slots_release_reason;
