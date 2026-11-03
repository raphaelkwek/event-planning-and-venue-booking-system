-- E2 is retired (W9-FX-5, W9-59): the Lead alone reassigns, and accepting a
-- proposal is refused. A proposal that was still pending when E4 shipped could
-- have been accepted until now, taking an event from its coordinator without the
-- Lead. Close each one, unaccepted, as E4 does when the Lead reassigns: status
-- CLOSED with resolved_at. Rows are kept, never deleted.
--
-- A data update on a table that only ever held a handful of rows; the status
-- check that allows CLOSED was added in 0010 and validated in 0011.
update event.reassignment_proposals
set status = 'CLOSED', resolved_at = now(), updated_at = now()
where status = 'PENDING';
