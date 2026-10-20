-- ---------------------------------------------------------------------------
-- L6: hold expiry. A Temporal timer per hold sends the coordinator a reminder
-- (reminded_at, at most once per expiry: a new expiry clears it) and then
-- expires the hold (status EXPIRED, expired_at), which frees its slot.
--
-- The check is added NOT VALID so no table scan holds a lock; 0014 validates
-- it. Existing rows already satisfy it: no hold is EXPIRED yet.
-- ---------------------------------------------------------------------------

alter table venue.holds
  add column reminded_at timestamptz,
  add column expired_at  timestamptz;

alter table venue.holds
  add constraint holds_expiry_recorded
  check ((status = 'EXPIRED') = (expired_at is not null)) not valid;
