-- E4 (W9-FX-5): the Lead alone reassigns, so E2's peer proposals are retired. A
-- proposal still pending when the Lead reassigns the event is closed,
-- unaccepted: status CLOSED, with resolved_at. Rows are never deleted.
--
-- The check is replaced NOT VALID here and validated in 0011, in a transaction
-- of its own, as 0007 and 0008 do. New rows are checked from here on.
alter table event.reassignment_proposals drop constraint reassignment_proposals_status_check;

alter table event.reassignment_proposals add constraint reassignment_proposals_status_check
  check (status in ('PENDING', 'ACCEPTED', 'DECLINED', 'CLOSED')) not valid;
