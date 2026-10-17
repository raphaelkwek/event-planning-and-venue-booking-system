# L1 — Submit a venue booking request

Fourteen cases, written from the story on 17 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| Only the coordinator assigned to the event can raise a booking request for it | L1-T1, L1-T11 |
| The request records venue, date, start and end time, room layout, expected attendance, and the required facilities and accessibility features | L1-T2 |
| Date, times and attendance default from the event; a changed value flags the request and the differing values are shown to Venue Staff | L1-T3, L1-T4 |
| On success the request is stored Pending, with the requesting coordinator, the timestamp and a unique booking reference | L1-T1 |
| The request appears in the venue's Venue Staff queue, as pending on the calendar, and notifies the venue's staff | L1-T5, L1-T6, L1-T7 |
| A second pending request for the same event, venue and overlapping period is refused, naming the existing one | L1-T8 |
| CR-03: an event may have requests for several venues at once, each decided separately | L1-T9 |
| CR-02: a request raised to replace a disrupted booking is linked to that booking | L1-T10 |
| A refused request creates no booking record and changes no venue availability | L1-T12, L1-T13, L1-T14 |

## How a request relates to a booking

A pending request doesn't reserve the venue. Two events can ask for the same venue and period;
Venue Staff decide (M1, M2), and approval is where double-booking is prevented (N1). So a request
is its own record, with status Pending, Approved, Rejected or Withdrawn (L2), and only an approval
creates a confirmed booking.

The one overlap a request can't have is with another **pending request of the same event for the
same venue** (L1-T8). Periods include their start but not their end, so 14:00–18:00 and
18:00–20:00 only touch.

A request can be raised once the event is approved: while it is Approved, Planning, Safety Review
or Confirmed (L1-T13). Raising one doesn't change the event's status.

**Booking references** are `BKR-` and six digits, from their own sequence.

**"The venue's Venue Staff"** are those linked to the venue in `venue.venue_staff`. H1 links the
Venue Staff member who creates a venue.

## Notifications travel through Kafka

L1-T7's notification is published to `connectsphere.venue-booking.v1`, like the other notifications
(T2). That topic doesn't exist on the Aiven cluster yet: it is created at the cutover to Confluent
(ADR-0008). Until then L1-T7 can't pass; the request is still stored, and its message waits in the
outbox and is delivered once the topic exists.

## FX-BOOKING

1. **FX-APPROVED.** Note the event's id and reference, and which coordinator its "Assigned
   coordinator" field names.
2. **FX-VENUE.** `venuestaff@connectsphere.test` creates `Lee Kong Chian Auditorium` and is linked to
   it.
3. **The FX-BOOKING statement** below, in the SQL editor. It adds three more venues, all created by
   `venuestaff@connectsphere.test`, so `npm run test-cases:reset` removes them:

| Venue | Layouts | Facilities | Accessibility features | Hours | Looked after by `venuestaff@` | Active |
|---|---|---|---|---|---|---|
| Seminar Room 2-1 | Classroom 60 · Boardroom 24 | Projector, Whiteboard | Step-free access | Mon–Fri 08:00–18:00 | yes | yes |
| Mochtar Riady Hall | Theatre 500 · Banquet 350 | Projector, Wireless microphones, Stage lighting, Livestream | Step-free access, Hearing loop | Every day 07:00–23:00 | **no** | yes |
| Old Lecture Theatre | Theatre 200 | Projector | Step-free access | Mon–Fri 08:00–22:00 | yes | **no** |

~~~sql
with hours as (
  select '{"monday":{"opensAt":"08:00","closesAt":"18:00"},"tuesday":{"opensAt":"08:00","closesAt":"18:00"},"wednesday":{"opensAt":"08:00","closesAt":"18:00"},"thursday":{"opensAt":"08:00","closesAt":"18:00"},"friday":{"opensAt":"08:00","closesAt":"18:00"},"saturday":null,"sunday":null}'::jsonb as seminar,
         '{"monday":{"opensAt":"07:00","closesAt":"23:00"},"tuesday":{"opensAt":"07:00","closesAt":"23:00"},"wednesday":{"opensAt":"07:00","closesAt":"23:00"},"thursday":{"opensAt":"07:00","closesAt":"23:00"},"friday":{"opensAt":"07:00","closesAt":"23:00"},"saturday":{"opensAt":"07:00","closesAt":"23:00"},"sunday":{"opensAt":"07:00","closesAt":"23:00"}}'::jsonb as hall,
         '{"monday":{"opensAt":"08:00","closesAt":"22:00"},"tuesday":{"opensAt":"08:00","closesAt":"22:00"},"wednesday":{"opensAt":"08:00","closesAt":"22:00"},"thursday":{"opensAt":"08:00","closesAt":"22:00"},"friday":{"opensAt":"08:00","closesAt":"22:00"},"saturday":null,"sunday":null}'::jsonb as weekdays
),
venues as (
  insert into venue.venues (name, building, max_capacity, layouts, facilities, accessibility_features,
                            operating_hours, status, created_by, updated_by)
  select v.name, v.building, v.max_capacity, v.layouts::jsonb, v.facilities, v.accessibility, v.hours, v.status,
         '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
  from hours, lateral (values
    ('Seminar Room 2-1', 'School of Computing, Level 2', 60,
     '[{"name":"Classroom","capacity":60},{"name":"Boardroom","capacity":24}]',
     array['Projector','Whiteboard'], array['Step-free access'], hours.seminar, 'ACTIVE'),
    ('Mochtar Riady Hall', 'Business School, Level 3', 500,
     '[{"name":"Theatre","capacity":500},{"name":"Banquet","capacity":350}]',
     array['Projector','Wireless microphones','Stage lighting','Livestream'], array['Step-free access','Hearing loop'],
     hours.hall, 'ACTIVE'),
    ('Old Lecture Theatre', 'School of Economics, Level 1', 200,
     '[{"name":"Theatre","capacity":200}]',
     array['Projector'], array['Step-free access'], hours.weekdays, 'INACTIVE')
  ) as v(name, building, max_capacity, layouts, facilities, accessibility, hours, status)
  returning id, name
)
insert into venue.venue_staff (venue_id, user_id, created_by, updated_by)
select id, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003',
       '00000000-0000-0000-0000-000000000003'
from venues
where name <> 'Mochtar Riady Hall';

select id, name from venue.venues
where created_by = '00000000-0000-0000-0000-000000000003'
order by name;
~~~

The last query lists the four venues with their **ids**, which the API-console cases use.

## FX-DISRUPTED (L1-T10)

Run after FX-BOOKING, with the event's id. It gives the event a confirmed booking at
`Seminar Room 2-1`, 2 December 2026 14:00–18:00, flagged Requires Reconfirmation, as I2 will when
a block disrupts it. It returns the booking's **id**.

~~~sql
insert into venue.venue_slots
  (venue_id, event_id, reference, starts_at, ends_at, status, requires_reconfirmation, created_by, updated_by)
select v.id, '<EVENT_ID>', 'L1-FX-DISRUPTED', timestamptz '2026-12-02 14:00+08', timestamptz '2026-12-02 18:00+08',
       'CONFIRMED', true, '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
from venue.venues v
where v.name = 'Seminar Room 2-1' and v.created_by = '00000000-0000-0000-0000-000000000003'
returning id;
~~~
