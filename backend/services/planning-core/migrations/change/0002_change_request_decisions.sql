-- S2 (SPM-58): a coordinator's decision on a change request. Who decided and
-- when, and the reason for a rejection. The check ties the columns to the
-- status; it is added NOT VALID and validated by 0003 in its own transaction.
alter table change.change_requests
  add column decided_by       uuid,
  add column decided_at       timestamptz,
  add column rejection_reason text;

alter table change.change_requests
  add constraint change_requests_decision_recorded check (
    (status = 'PENDING' and decided_by is null and decided_at is null and rejection_reason is null)
    or (status = 'APPROVED' and decided_by is not null and decided_at is not null and rejection_reason is null)
    or (status = 'REJECTED' and decided_by is not null and decided_at is not null
        and rejection_reason is not null and length(btrim(rejection_reason)) > 0)
  ) not valid;
