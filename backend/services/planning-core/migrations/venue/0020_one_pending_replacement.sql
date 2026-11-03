-- L5 (CR-02), audit of 2 Nov 2026: at most one pending replacement request per
-- disrupted booking. Two could be raised for the same booking; approving the
-- first released the booking, and approving the second then confirmed an extra
-- booking that replaced nothing. "Another replacement can be requested" (L5)
-- once the pending one is rejected or withdrawn, which this still allows: the
-- index covers Pending rows only.
--
-- A single-row insert against a unique index decides it, so two simultaneous
-- submissions can't both pass (implementation.md §4.5), as for
-- holds_one_live_per_event_and_venue (0012) and booking_requests_booking_idx
-- (0007). Built in this file's transaction, like those: CONCURRENTLY can't run
-- inside one, and .squawk.toml explains why that rule is off.
--
-- If the shared database already holds two Pending replacements for one
-- booking, this fails and changes nothing. Find them with:
--   select replaces_booking_id, array_agg(reference) from venue.booking_requests
--   where status = 'PENDING' and replaces_booking_id is not null
--   group by 1 having count(*) > 1;
-- and have the coordinator withdraw all but one before migrating again.

create unique index booking_requests_one_pending_replacement_idx
  on venue.booking_requests (replaces_booking_id)
  where (status = 'PENDING' and replaces_booking_id is not null);
