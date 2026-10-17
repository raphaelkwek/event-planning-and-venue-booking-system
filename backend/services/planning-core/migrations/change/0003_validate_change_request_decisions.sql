-- S2: validates the check 0002 added, in its own transaction so the scan does not hold 0002's lock.
alter table change.change_requests validate constraint change_requests_decision_recorded;
