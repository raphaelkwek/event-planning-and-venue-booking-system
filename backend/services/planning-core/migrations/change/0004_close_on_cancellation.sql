-- F3 (SPM-29), Week 9 answer W9-07: cancelling an event closes the change
-- request still pending for it, recording why. A closed request can no longer
-- be decided. `decided_by` and `decided_at` say who closed it and when (the
-- user who cancelled the event); `closed_reason` says why.
--
-- Both checks are replaced and added NOT VALID, then validated in 0005 in their
-- own transaction, as event/0007 and 0008 did. New rows are checked from here on.
alter table change.change_requests add column closed_reason text;

alter table change.change_requests drop constraint change_requests_status_check;

alter table change.change_requests add constraint change_requests_status_check
  check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CLOSED')) not valid;

alter table change.change_requests drop constraint change_requests_decision_recorded;

alter table change.change_requests add constraint change_requests_decision_recorded check (
  (status = 'PENDING' and decided_by is null and decided_at is null and rejection_reason is null and closed_reason is null)
  or (status = 'APPROVED' and decided_by is not null and decided_at is not null
      and rejection_reason is null and closed_reason is null)
  or (status = 'REJECTED' and decided_by is not null and decided_at is not null
      and rejection_reason is not null and length(btrim(rejection_reason)) > 0 and closed_reason is null)
  or (status = 'CLOSED' and decided_by is not null and decided_at is not null
      and rejection_reason is null and closed_reason is not null and length(btrim(closed_reason)) > 0)
) not valid;
