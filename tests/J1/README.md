# J1 — Filter venues against event requirements

Twenty-four cases, written from the story on 10 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| Filters available: date and time window, minimum capacity, building/location, required accessibility features, required layout, required facilities | J1-T1, J1-T2, J1-T6, J1-T7, J1-T8, J1-T9, J1-T10 |
| Only venues satisfying every selected filter are returned; a venue missing one required facility is excluded | J1-T8, J1-T9, J1-T10 |
| Venues with a confirmed booking, hold or recorded unavailability overlapping the window are excluded (touching periods do not overlap), and so are venues closed during the window | J1-T11, J1-T12, J1-T13, J1-T14, J1-T15, J1-T16 |
| CR-01: existing bookings are compared by their occupied periods, and the requested window is widened by the venue's setup and turnaround time (H3) | J1-T17, J1-T18 |
| Inactive venues are excluded | J1-T19 |
| Capacity uses the chosen layout's capacity when a layout filter is set, and the maximum capacity otherwise | J1-T2, J1-T3, J1-T4, J1-T5 |
| No match gives an empty list and a message restating the filters, not an error | J1-T20 (and J1-T3, J1-T6, J1-T13, J1-T15, J1-T16) |
| Opened from an event, the filters are pre-filled from its requirements and stay editable | J1-T21, J1-T22 |

J1-T23 checks that a bad window is refused with the field named. J1-T24 checks that only Event
Coordinators can search (policy action `search` on `venue`).

**J1-T18 cannot run yet.** The venue's own setup and turnaround time are H3's, and H3 is not
merged. Until it is, the search widens the requested window by 0 minutes. When H3 lands, the
widening is a one-line change in `repo/venueSearch.ts` (the `venueSetupMinutes` and
`venueTurnaroundMinutes` fragments), and J1-T18 becomes runnable. J1-T17 does run now, because an
existing booking's own setup and turnaround time are already stored on its slot (EN-02.1).

Times are Singapore time (UTC+8). A period includes its start but not its end, so a window that
starts at 12:00 does not overlap a booking that ends at 12:00.

## FX-SEARCH

FX-SEARCH gives the search five venues, four active and one inactive, with the bookings, hold and
blocks the cases need. Run it in the SQL editor. Everything it creates belongs to
`venuestaff@connectsphere.test`, so `npm run test-cases:reset` removes it. Other venues in the
shared database may appear in results; judge only the rows whose name starts with `FX `.

| Venue | Building | Maximum | Layouts | Facilities | Accessibility | Hours | Status |
|---|---|---|---|---|---|---|---|
| FX Auditorium | FX Science Block | 300 | Theatre 300 · Classroom 120 | Projector · Wireless microphones | Step-free access · Hearing loop | Mon–Fri 08:00–22:00 · Sat 09:00–18:00 · Sun closed | Active |
| FX Seminar Room | FX Science Block | 60 | Classroom 40 · Boardroom 20 | Projector | Step-free access | as above | Active |
| FX Lecture Hall | FX Arts Building | 200 | Theatre 200 · Classroom 80 | Projector · Wireless microphones · Stage lighting | Step-free access · Hearing loop · Accessible toilet | as above | Active |
| FX Old Gym | FX Arts Building | 500 | Theatre 500 | Projector · Wireless microphones · Stage lighting | Step-free access · Hearing loop · Accessible toilet | as above | **Inactive** |
| FX Late Studio | FX Media Centre | 100 | Theatre 100 | Projector | Step-free access | Mon–Fri 12:00–20:00 · Sat and Sun closed | Active |

| Commitment | Venue | Period | Effect |
|---|---|---|---|
| `J1-FX-CONFIRMED` confirmed booking | FX Auditorium | Mon 14 Dec 2026 10:00–12:00 | blocks 10:00–12:00 |
| `J1-FX-HELD` hold | FX Seminar Room | Mon 14 Dec 2026 14:00–16:00 | blocks 14:00–16:00 |
| `J1-FX-OCCUPIED` confirmed booking, 30 min setup and 30 min turnaround | FX Auditorium | Tue 15 Dec 2026 14:00–16:00 | blocks 13:30–16:30 |
| `J1-FX-RELEASED` released slot | FX Lecture Hall | Mon 14 Dec 2026 15:00–17:00 | blocks nothing |
| maintenance block, active | FX Lecture Hall | Mon 14 Dec 2026 09:00–13:00 | blocks 09:00–13:00 |
| renovation block, removed | FX Lecture Hall | Wed 16 Dec 2026 09:00–13:00 | blocks nothing |

~~~sql
with venues as (
  insert into venue.venues (
    name, building, max_capacity, layouts, facilities, accessibility_features, operating_hours,
    status, created_by, updated_by
  )
  select v.name, v.building, v.max_capacity, v.layouts::jsonb, v.facilities, v.accessibility_features,
         v.hours::jsonb, v.status,
         '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
  from (values
    ('FX Auditorium', 'FX Science Block', 300,
     '[{"name":"Theatre","capacity":300},{"name":"Classroom","capacity":120}]',
     array['Projector','Wireless microphones'], array['Step-free access','Hearing loop'],
     '{"monday":{"opensAt":"08:00","closesAt":"22:00"},"tuesday":{"opensAt":"08:00","closesAt":"22:00"},"wednesday":{"opensAt":"08:00","closesAt":"22:00"},"thursday":{"opensAt":"08:00","closesAt":"22:00"},"friday":{"opensAt":"08:00","closesAt":"22:00"},"saturday":{"opensAt":"09:00","closesAt":"18:00"},"sunday":null}',
     'ACTIVE'),
    ('FX Seminar Room', 'FX Science Block', 60,
     '[{"name":"Classroom","capacity":40},{"name":"Boardroom","capacity":20}]',
     array['Projector'], array['Step-free access'],
     '{"monday":{"opensAt":"08:00","closesAt":"22:00"},"tuesday":{"opensAt":"08:00","closesAt":"22:00"},"wednesday":{"opensAt":"08:00","closesAt":"22:00"},"thursday":{"opensAt":"08:00","closesAt":"22:00"},"friday":{"opensAt":"08:00","closesAt":"22:00"},"saturday":{"opensAt":"09:00","closesAt":"18:00"},"sunday":null}',
     'ACTIVE'),
    ('FX Lecture Hall', 'FX Arts Building', 200,
     '[{"name":"Theatre","capacity":200},{"name":"Classroom","capacity":80}]',
     array['Projector','Wireless microphones','Stage lighting'],
     array['Step-free access','Hearing loop','Accessible toilet'],
     '{"monday":{"opensAt":"08:00","closesAt":"22:00"},"tuesday":{"opensAt":"08:00","closesAt":"22:00"},"wednesday":{"opensAt":"08:00","closesAt":"22:00"},"thursday":{"opensAt":"08:00","closesAt":"22:00"},"friday":{"opensAt":"08:00","closesAt":"22:00"},"saturday":{"opensAt":"09:00","closesAt":"18:00"},"sunday":null}',
     'ACTIVE'),
    ('FX Old Gym', 'FX Arts Building', 500,
     '[{"name":"Theatre","capacity":500}]',
     array['Projector','Wireless microphones','Stage lighting'],
     array['Step-free access','Hearing loop','Accessible toilet'],
     '{"monday":{"opensAt":"08:00","closesAt":"22:00"},"tuesday":{"opensAt":"08:00","closesAt":"22:00"},"wednesday":{"opensAt":"08:00","closesAt":"22:00"},"thursday":{"opensAt":"08:00","closesAt":"22:00"},"friday":{"opensAt":"08:00","closesAt":"22:00"},"saturday":{"opensAt":"09:00","closesAt":"18:00"},"sunday":null}',
     'INACTIVE'),
    ('FX Late Studio', 'FX Media Centre', 100,
     '[{"name":"Theatre","capacity":100}]',
     array['Projector'], array['Step-free access'],
     '{"monday":{"opensAt":"12:00","closesAt":"20:00"},"tuesday":{"opensAt":"12:00","closesAt":"20:00"},"wednesday":{"opensAt":"12:00","closesAt":"20:00"},"thursday":{"opensAt":"12:00","closesAt":"20:00"},"friday":{"opensAt":"12:00","closesAt":"20:00"},"saturday":null,"sunday":null}',
     'ACTIVE')
  ) as v(name, building, max_capacity, layouts, facilities, accessibility_features, hours, status)
  returning id, name
),
slots as (
  insert into venue.venue_slots (
    venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes, status,
    created_by, updated_by
  )
  select venues.id, gen_random_uuid(), s.reference, s.starts_at, s.ends_at, s.setup, s.turnaround, s.status,
         '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'
  from venues
  join (values
    ('FX Auditorium',   'J1-FX-CONFIRMED', timestamptz '2026-12-14 10:00+08', timestamptz '2026-12-14 12:00+08',  0,  0, 'CONFIRMED'),
    ('FX Seminar Room', 'J1-FX-HELD',      timestamptz '2026-12-14 14:00+08', timestamptz '2026-12-14 16:00+08',  0,  0, 'HELD'),
    ('FX Auditorium',   'J1-FX-OCCUPIED',  timestamptz '2026-12-15 14:00+08', timestamptz '2026-12-15 16:00+08', 30, 30, 'CONFIRMED'),
    ('FX Lecture Hall', 'J1-FX-RELEASED',  timestamptz '2026-12-14 15:00+08', timestamptz '2026-12-14 17:00+08',  0,  0, 'RELEASED')
  ) as s(name, reference, starts_at, ends_at, setup, turnaround, status) on s.name = venues.name
  returning id
),
blocks as (
  insert into venue.unavailability_blocks (
    venue_id, starts_at, ends_at, reason_type, description, status, created_by, updated_by
  )
  select venues.id, b.starts_at, b.ends_at, b.reason_type, b.description, b.status,
         '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
  from venues
  join (values
    ('FX Lecture Hall', timestamptz '2026-12-14 09:00+08', timestamptz '2026-12-14 13:00+08', 'MAINTENANCE', 'J1 fixture: stage lighting rewiring', 'ACTIVE'),
    ('FX Lecture Hall', timestamptz '2026-12-16 09:00+08', timestamptz '2026-12-16 13:00+08', 'RENOVATION',  'J1 fixture: seat replacement',        'REMOVED')
  ) as b(name, starts_at, ends_at, reason_type, description, status) on b.name = venues.name
  returning id
)
select (select count(*) from venues) as venues, (select count(*) from slots) as slots, (select count(*) from blocks) as blocks;
~~~

It returns `venues 5, slots 4, blocks 2`.

## FX-SEARCH-EVENT

Run after FX-SEARCH. It creates the event `FX Symposium` owned by `organiser@connectsphere.test`,
so the reset removes it. Its requirements are what J1-T21 and J1-T22 expect the search to
pre-fill. It returns the event's **id** and **reference**.

~~~sql
insert into event.events (
  reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
  expected_attendance, venue_requirements, accessibility_needs, equipment_required,
  registration_required, status, submitted_at, last_saved_at, created_by, updated_by
) values (
  'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
  '00000000-0000-0000-0000-000000000001', 'FX Symposium', 'Share faculty research',
  'A J1 search fixture.', timestamptz '2026-12-14 12:00+08', timestamptz '2026-12-14 14:00+08',
  150, '{"layout":"Theatre","facilities":["Projector","Wireless microphones"]}',
  'Step-free access, Hearing loop, Reserved seating', false, false, 'PLANNING', now(), now(),
  '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
)
returning id, reference;
~~~
