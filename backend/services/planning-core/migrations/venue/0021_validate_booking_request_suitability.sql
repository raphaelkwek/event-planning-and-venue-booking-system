-- L9, audit of 2 Nov 2026: validates the two checks 0011 added NOT VALID, in
-- a transaction of their own, as 0008, 0010, 0015 and 0017 do for theirs.
-- Requests made before K2 have all three suitability columns null, which both
-- checks allow, and every row written since 0011 was checked as it was
-- written, so validation finds nothing to refuse.
alter table venue.booking_requests validate constraint booking_requests_suitability_status_check;
alter table venue.booking_requests validate constraint booking_requests_justification_recorded;
