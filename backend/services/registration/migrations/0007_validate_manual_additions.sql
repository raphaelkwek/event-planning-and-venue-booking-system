-- R7: validates 0005's checks on manual additions, in a migration of its own
-- so the scan doesn't share 0005's lock (squawk's add-then-validate pattern).
alter table registration.registrations validate constraint registrations_manual_fields;
alter table registration.registrations validate constraint registrations_addition_reason_length;
