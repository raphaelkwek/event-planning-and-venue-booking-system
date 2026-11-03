-- F3 (SPM-29): a cancelled event keeps why, by whom and when it was cancelled,
-- shown on the event (AC3, AC4). The columns are written in the same statement
-- as the status (transitionEvent's `set`), and the check ties them to it: the
-- event is CANCELLED exactly when all three are present and the reason is not
-- blank. Numbered 0012 because E4 and E5 (open) take 0010 and 0011; migrate.ts
-- tracks each file by name, so the gap does no harm.
--
-- The check is added NOT VALID and validated in 0013, in its own transaction,
-- as 0007 and 0008 did. No existing row is CANCELLED: no path set it before F3.
alter table event.events
  add column cancellation_reason text,
  add column cancelled_by        uuid,
  add column cancelled_at        timestamptz;

alter table event.events
  add constraint events_cancellation_recorded check (
    (status = 'CANCELLED') = (
      cancelled_by is not null and cancelled_at is not null
      and cancellation_reason is not null and length(btrim(cancellation_reason)) > 0
    )
  ) not valid;
