-- ---------------------------------------------------------------------------
-- R5 and R7: who may see an event's registrations and add attendees by hand,
-- and what a manual addition records.
--
-- event_listings.assigned_coordinator_id comes from event.listing-changed,
-- which planning-core now writes on each change of coordinator too (E2 to E4).
-- R5 and R7 admit the owner and this coordinator only. Null until a message
-- naming one arrives.
--
-- A registration added by the owning organiser or the assigned coordinator
-- (R7) records who added it (added_by), why (addition_reason, optional) and
-- whether it took the event above capacity (added_over_capacity, D-01). Its
-- time is registered_at. A self-registration has none of these. An addition
-- above capacity holds no seat until a withdrawal hands it one: the flag stays,
-- as the record of how the attendee was added.
--
-- The checks are added NOT VALID and validated in 0007, so adding them takes
-- no long lock on a table that may hold rows (squawk).
-- ---------------------------------------------------------------------------
alter table registration.event_listings add column assigned_coordinator_id uuid;

alter table registration.registrations
  add column added_by uuid,
  add column addition_reason text,
  add column added_over_capacity boolean not null default false;

alter table registration.registrations
  add constraint registrations_manual_fields
  check (added_by is not null or (addition_reason is null and not added_over_capacity)) not valid;

alter table registration.registrations
  add constraint registrations_addition_reason_length
  check (addition_reason is null or char_length(addition_reason) between 1 and 500) not valid;

-- R7: the registrations without a seat, earliest first, which a freed seat goes to before it is free.
create index registrations_unseated_idx on registration.registrations (event_id, registered_at, id)
  where status = 'REGISTERED' and seat_id is null;
