-- Q2 (SPM-51): a reservation is released, never deleted. It keeps who released
-- it, when and why. The check is added NOT VALID and validated in 0008, in its
-- own transaction; every existing row is RESERVED with these columns null.
alter table equipment.reservations
  add column released_by    uuid,
  add column released_at    timestamptz,
  add column release_reason text;

alter table equipment.reservations
  add constraint reservations_release_recorded check (
    (status = 'RESERVED' and released_by is null and released_at is null and release_reason is null)
    or (status = 'RELEASED' and released_by is not null and released_at is not null
        and release_reason is not null and length(btrim(release_reason)) > 0)
  ) not valid;
