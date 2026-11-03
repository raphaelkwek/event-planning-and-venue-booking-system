# R1 — Browse events open for registration

Eight cases, written from the story on 2 Nov 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| The list contains only events with registration enabled and status Confirmed, whose registration closing date/time has not passed | R1-T1, R1-T3, R1-T4, R1-T5 |
| Each entry shows event name, description, date, start and end time, venue name and location, and the number of places remaining, derived from the capacity of the booked venue for the booked layout (R2) | R1-T1, R1-T7 |
| CR-03: an event with several venues (L4) lists each of them; places remaining follow R2 | R1-T2 |
| Internal information (review comments, clarification threads, coordinator notes, booking and equipment records) is not shown | R1-T8 |
| An event whose places remaining is zero is shown with a Full label and offers no register action | R1-T6, R1-T7 |
| Events that are Draft, Submitted, Under Review, Approved, Planning, Rejected, or Cancelled do not appear | R1-T4 |

R1-T4 also checks Safety Review and Completed, which the criterion doesn't name but which are not
Confirmed either.

## Where the list comes from

The attendee screens are served by the **registration service** (ADR-0005), not planning-core. It
never reads planning-core's tables. It keeps its own copy of what an attendee may see of each
event, built from two Kafka messages:

- `event.listing-changed` (planning-core's event module): the event's name, description, status,
  date and times, and its registration settings. It is written whenever any of those changes.
- `venue-booking.request-approved` (the venue module, M1): each confirmed booking's venue name,
  location, layout and layout capacity. The seats are built from the same message (EN-13).

So the list holds only published fields: nothing internal ever reaches the registration service
(R1-T8).

**Until U1 can confirm an event,** no user action makes one Confirmed, and these messages need
Kafka. The cases therefore build their events in the registration service's own tables with the
statements below, in the Supabase SQL editor. They create rows only the R cases use: every
event reference starts `EVT-R`.

## FX-R-EVENT statement

Replace each `<…>` with the case's value, or its default: `<NAME>` `R Test Symposium`,
`<STATUS>` `CONFIRMED`, `<REQUIRED>` `true`, `<OPENS>` `now() - interval '1 day'`, `<CLOSES>`
`now() + interval '7 days'`, `<DEADLINE>` `null`, `<SEATS>` `3`. The event is on Wednesday 16
December 2026, 14:00–18:00 Singapore time, at `Lee Kong Chian Auditorium`, `School of Computing,
Level 1`, Theatre layout. Note the returned **event_id** and **event_reference**.

~~~sql
with listing as (
  insert into registration.event_listings (
    event_id, event_reference, name, description, owner_id, status, starts_at, ends_at,
    registration_required, registration_opens_at, registration_closes_at, withdrawal_deadline_at,
    source_changed_at
  ) values (
    gen_random_uuid(), 'EVT-R' || lpad(floor(random() * 100000)::int::text, 5, '0'), '<NAME>',
    'A one-day symposium for the school of computing.', '00000000-0000-0000-0000-000000000001',
    '<STATUS>', '2026-12-16T06:00:00Z', '2026-12-16T10:00:00Z',
    <REQUIRED>, <OPENS>, <CLOSES>, <DEADLINE>, now()
  ) returning event_id, event_reference
), venue as (
  insert into registration.event_venues (
    event_id, booking_id, venue_id, venue_name, venue_location, layout, layout_capacity, starts_at, ends_at
  )
  select event_id, gen_random_uuid(), gen_random_uuid(), 'Lee Kong Chian Auditorium',
         'School of Computing, Level 1', 'Theatre', <SEATS>, '2026-12-16T06:00:00Z', '2026-12-16T10:00:00Z'
  from listing
  returning event_id, booking_id
), seats as (
  insert into registration.seats (event_id, booking_id, seat_no)
  select venue.event_id, venue.booking_id, n from venue, generate_series(1, <SEATS>) as n
  returning id
)
select event_id, event_reference from listing;
~~~

## FX-R-SECOND-VENUE statement

A second confirmed venue for the event: `Seminar Room 2-1`, `School of Computing, Level 2`,
Classroom layout, `<SEATS>` seats.

~~~sql
with venue as (
  insert into registration.event_venues (
    event_id, booking_id, venue_id, venue_name, venue_location, layout, layout_capacity, starts_at, ends_at
  ) values (
    '<EVENT_ID>', gen_random_uuid(), gen_random_uuid(), 'Seminar Room 2-1', 'School of Computing, Level 2',
    'Classroom', <SEATS>, '2026-12-16T06:00:00Z', '2026-12-16T10:00:00Z'
  ) returning event_id, booking_id
)
insert into registration.seats (event_id, booking_id, seat_no)
select event_id, booking_id, n from venue, generate_series(1, <SEATS>) as n;
~~~

## FX-R-TAKEN statement

`<N>` places taken by other attendees, each a registration holding a seat, as R2 would make them.

~~~sql
with taken as (
  update registration.seats
  set status = 'CLAIMED', claimed_by = gen_random_uuid(), claimed_at = now(), updated_at = now()
  where id in (
    select id from registration.seats
    where event_id = '<EVENT_ID>' and status = 'FREE'
    order by seat_no limit <N>
  )
  returning id, event_id, claimed_by
)
insert into registration.registrations (event_id, attendee_id, seat_id)
select event_id, claimed_by, id from taken;
~~~

## FX-R-OTHER-ATTENDEE statement

One registration belonging to another attendee, `00000000-0000-0000-0000-0000000000a5` (no account
needs to exist for it). Note the returned **id** and **reference**.

~~~sql
with taken as (
  update registration.seats
  set status = 'CLAIMED', claimed_by = '00000000-0000-0000-0000-0000000000a5', claimed_at = now(), updated_at = now()
  where id = (
    select id from registration.seats
    where event_id = '<EVENT_ID>' and status = 'FREE'
    order by seat_no limit 1
  )
  returning id, event_id, claimed_by
)
insert into registration.registrations (event_id, attendee_id, seat_id)
select event_id, claimed_by, id from taken
returning id, reference;
~~~

## Removing the R fixtures

`npm run test-cases:reset` doesn't touch the registration service's tables. Before a run, remove
what earlier R cases created (only `EVT-R` events):

~~~sql
delete from registration.registrations where event_id in (select event_id from registration.event_listings where event_reference like 'EVT-R%');
delete from registration.seats where event_id in (select event_id from registration.event_listings where event_reference like 'EVT-R%');
delete from registration.event_venues where event_id in (select event_id from registration.event_listings where event_reference like 'EVT-R%');
delete from registration.event_listings where event_reference like 'EVT-R%';
~~~
