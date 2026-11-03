-- F3: validates the check 0012 added NOT VALID, in its own transaction so the
-- scan of existing rows does not run under 0012's lock. No row fails: none is
-- CANCELLED, and none has the new columns set.
alter table event.events validate constraint events_cancellation_recorded;
