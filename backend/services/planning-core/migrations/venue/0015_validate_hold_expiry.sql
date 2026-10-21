-- L6: validates 0014's check in a transaction of its own.
alter table venue.holds validate constraint holds_expiry_recorded;
