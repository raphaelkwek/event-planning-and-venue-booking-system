-- L6: validates 0013's check in a transaction of its own.
alter table venue.holds validate constraint holds_expiry_recorded;
