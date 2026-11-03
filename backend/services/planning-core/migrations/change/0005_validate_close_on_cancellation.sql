-- F3: validates the two checks 0004 replaced, in its own transaction so the
-- scan does not hold 0004's lock. No existing row fails: none is CLOSED and
-- none has a closed_reason, and every other branch is the check it replaces.
alter table change.change_requests validate constraint change_requests_status_check;

alter table change.change_requests validate constraint change_requests_decision_recorded;
