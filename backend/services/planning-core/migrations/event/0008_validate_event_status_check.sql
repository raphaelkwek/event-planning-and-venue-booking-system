-- CR-06: validates the status check 0007 added NOT VALID. A separate file,
-- so the scan of existing rows runs in its own transaction under a lock
-- that does not block writes (migrate.ts applies one file per transaction).
-- No existing row can fail: the new list is the old ten plus SAFETY_REVIEW.
alter table event.events validate constraint events_status_check;
