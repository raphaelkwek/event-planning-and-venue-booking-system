# R5 — View the registrations for an event I manage

Six cases, written from the story on 3 Nov 2026, before the code. The `FX-R-…` statements are in
`tests/R1/README.md` and below.

| Acceptance criterion | Cases |
|---|---|
| The owning organiser and the assigned coordinator can view the registration list for that event; other users cannot, and receive no registration data | R5-T1, R5-T2, R5-T3 |
| Each row shows the attendee's name, the registration timestamp, and the current registration status | R5-T1 |
| Totals are shown for registered, withdrawn, and places remaining, derived from the registration records | R5-T4, R5-T6 |
| A withdrawal is reflected in both the row status and the totals when the list is next loaded | R5-T5 |

R4-T12 (the owning organiser sees the updated totals after a withdrawal) is proven with R5-T5.
R7-T9 checks that manual additions are told apart in this list, and R6-T9 that waitlist entries
are never counted in it.

## Where the list is

The screen is "Registrations", at `#/events/<EVENT_ID>/registrations`, reached from the event's
page with the "Registrations" button (the organiser's request page and the coordinator's review
page). It is served by the registration service, which holds the registrations. An event the
caller neither owns nor coordinates answers 404, the same as an event that doesn't exist, so the
response carries no registration data.

## FX-R-MANAGED statement

FX-R-EVENT's events are owned by Organiser One. This makes Coordinator One their assigned
coordinator, as the event's `event.listing-changed` message would after E3:

~~~sql
update registration.event_listings
set assigned_coordinator_id = '00000000-0000-0000-0000-000000000002', updated_at = now()
where event_id = '<EVENT_ID>';
~~~

## FX-R-WITHDRAW-ONE statement

One of FX-R-TAKEN's registrations withdrawn, as R4 would leave it (only where nobody was added
over capacity):

~~~sql
with one as (
  update registration.registrations
  set status = 'WITHDRAWN', withdrawn_at = now(), updated_at = now()
  where id = (
    select id from registration.registrations
    where event_id = '<EVENT_ID>' and status = 'REGISTERED' and added_by is null
      and attendee_id <> '00000000-0000-0000-0000-000000000005'
    order by registered_at limit 1
  )
  returning seat_id
)
update registration.seats set status = 'FREE', claimed_by = null, claimed_at = null, updated_at = now()
where id in (select seat_id from one);
~~~

## FX-R-WAITLISTED statement

`<N>` other attendees on the event's waitlist, in order, as R6 would store them:

~~~sql
insert into registration.waitlist_entries (event_id, attendee_id, joined_at)
select '<EVENT_ID>', gen_random_uuid(), now() - (<N> - n) * interval '1 minute'
from generate_series(1, <N>) as n;
~~~

## FX-R-NO-VENUE statement

An event listed with registration open but no confirmed venue booking, so no capacity yet. Note
the returned **event_id**.

~~~sql
insert into registration.event_listings (
  event_id, event_reference, name, description, owner_id, status, starts_at, ends_at,
  registration_required, registration_opens_at, registration_closes_at, source_changed_at
) values (
  gen_random_uuid(), 'EVT-R' || lpad(floor(random() * 100000)::int::text, 5, '0'), 'R Test Symposium',
  'A one-day symposium for the school of computing.', '00000000-0000-0000-0000-000000000001',
  'CONFIRMED', '2026-12-16T06:00:00Z', '2026-12-16T10:00:00Z', true,
  now() - interval '1 day', now() + interval '7 days', now()
) returning event_id, event_reference;
~~~

## Attendee Two

R6 and R7 need a second attendee who signs in, to free a place by withdrawing. The seed
(`npm run seed:auth`) has one attendee, `attendee@connectsphere.test`. Before those walk-throughs,
add `attendee2@connectsphere.test` (display name `Attendee Two`, role Attendee, the same password)
the way Attendee One is seeded: a row in `identity.users` and `identity.user_roles` as
`backend/services/planning-core/migrations/identity/seed/0001_seed_users.sql` and
`0003_seed_display_names.sql` do, and an entry in `seed-auth-users.ts` beside them, then run
`npm run seed:auth`. This package doesn't change the seed: running it touches the shared Supabase
project.

## Removing the R5 to R7 fixtures

As in `tests/R1/README.md`, and first:

~~~sql
delete from registration.waitlist_entries where event_id in (select event_id from registration.event_listings where event_reference like 'EVT-R%');
~~~
