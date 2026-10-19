# I1 — View a venue's availability calendar

Fifteen cases, written from the story on 7 Oct 2026, before the code.

| Acceptance criterion | Cases |
|---|---|
| An internal user selects a venue and a date range and sees each day's committed and free periods | I1-T1, I1-T7, I1-T11, I1-T12, I1-T13, I1-T14, I1-T15 |
| Confirmed bookings are shown as unavailable, labelled with the event reference | I1-T2 |
| Pending booking requests are shown in a visually distinct state and labelled as pending | I1-T3 |
| Recorded unavailability is shown with its recorded type or reason | I1-T4, I1-T12 |
| CR-01: each booking and hold is shown with its setup time before it and its turnaround time after it, occupied and distinct from the event | I1-T5, I1-T14 |
| Periods outside the venue's operating hours are shown as unavailable | I1-T6, I1-T14 |
| After a booking is approved, rejected, withdrawn or released, the calendar reflects the new state when next loaded | I1-T8, I1-T9 |
| Attendees have no access to the calendar | I1-T10 |

## Holds, requests and blocks come from a fixture

The rows the calendar reads are written by stories that aren't built yet: holds by L3, booking
requests by L1, approvals by M1, rejections by M2, releases by L5 and blocks by I2. Until they
are, FX-CALENDAR writes those rows directly, and I1-T8 and I1-T9 change a slot's status the way
those stories will.

A booking request is a hold that has been converted (implementation.md §4.6, rule 3). Its slot stays
HELD until M1 approves it (CONFIRMED) or M2 rejects it (RELEASED). The calendar therefore shows
every HELD slot as **Pending**.

## Times

All times are Singapore time (UTC+8), which is the time zone the calendar shows. Days run from
00:00 to 24:00, and a period includes its start but not its end. A period ending at 12:30 and one
starting at 12:30 touch without overlapping.

## FX-CALENDAR

FX-VENUE, then run this statement in the SQL editor with the venue's id in place of `<VENUE_ID>`.
It returns four events, each with its **reference** (`EVT-` and six digits). The cases call them
`<REF-SYMPOSIUM>`, `<REF-ALUMNI>`, `<REF-WORKSHOP>` and `<REF-LECTURE>`.

The events are owned by `organiser@connectsphere.test`, and the slots and blocks belong to a venue
created by `venuestaff@connectsphere.test`, so `npm run test-cases:reset` removes them all.

~~~sql
with venue as (
  select '<VENUE_ID>'::uuid as id
),
events as (
  insert into event.events (
    reference, owner_id, name, purpose, description, proposed_start_at, proposed_end_at,
    expected_attendance, equipment_required, registration_required, status, submitted_at,
    last_saved_at, created_by, updated_by
  )
  select 'EVT-' || lpad(nextval('event.event_reference_seq')::text, 6, '0'),
         '00000000-0000-0000-0000-000000000001', e.name, 'Share faculty research',
         'An I1 calendar fixture.', e.starts_at, e.ends_at, 150, false, false, 'PLANNING', now(), now(),
         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001'
  from (values
    ('Annual Research Symposium', timestamptz '2026-12-07 10:00+08', timestamptz '2026-12-07 12:00+08'),
    ('Alumni Networking Night',   timestamptz '2026-12-07 14:00+08', timestamptz '2026-12-07 16:00+08'),
    ('Saturday Coding Workshop',  timestamptz '2026-12-12 15:00+08', timestamptz '2026-12-12 17:00+08'),
    ('Guest Lecture',             timestamptz '2026-12-11 10:00+08', timestamptz '2026-12-11 12:00+08')
  ) as e(name, starts_at, ends_at)
  returning id, reference, name, proposed_start_at, proposed_end_at
),
slots as (
  insert into venue.venue_slots (
    venue_id, event_id, reference, starts_at, ends_at, setup_minutes, turnaround_minutes,
    status, created_by, updated_by
  )
  select venue.id, events.id, s.reference, events.proposed_start_at, events.proposed_end_at,
         s.setup_minutes, s.turnaround_minutes, s.status,
         '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002'
  from venue, events
  join (values
    ('Annual Research Symposium', 'I1-FX-SYMPOSIUM', 30, 30, 'CONFIRMED'),
    ('Alumni Networking Night',   'I1-FX-ALUMNI',    15, 45, 'HELD'),
    ('Saturday Coding Workshop',  'I1-FX-WORKSHOP',   0, 60, 'CONFIRMED'),
    ('Guest Lecture',             'I1-FX-LECTURE',    0,  0, 'RELEASED')
  ) as s(name, reference, setup_minutes, turnaround_minutes, status) on s.name = events.name
  returning id
),
blocks as (
  insert into venue.unavailability_blocks (
    venue_id, starts_at, ends_at, reason_type, description, status, created_by, updated_by
  )
  select venue.id, b.starts_at, b.ends_at, b.reason_type, b.description, b.status,
         '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
  from venue, (values
    (timestamptz '2026-12-08 09:00+08', timestamptz '2026-12-08 13:00+08', 'MAINTENANCE', 'Stage lighting rewiring', 'ACTIVE'),
    (timestamptz '2026-12-09 18:00+08', timestamptz '2026-12-10 12:00+08', 'RENOVATION',  'Seat replacement',        'ACTIVE'),
    (timestamptz '2026-12-11 14:00+08', timestamptz '2026-12-11 15:00+08', 'SAFETY',      'Fire drill',              'REMOVED')
  ) as b(starts_at, ends_at, reason_type, description, status)
  returning id
)
select name, reference,
       (select count(*) from slots) as slots, (select count(*) from blocks) as blocks
from events order by proposed_start_at;
~~~

### The week it gives

The standard venue's hours apply: Monday to Friday 08:00–22:00, Saturday 09:00–18:00, Sunday
closed.

| Day | Committed | Free |
|---|---|---|
| Mon 7 Dec | 00:00–08:00 outside operating hours · 09:30–10:00 setup, 10:00–12:00 **confirmed**, 12:00–12:30 turnaround (`<REF-SYMPOSIUM>`) · 13:45–14:00 setup, 14:00–16:00 **pending**, 16:00–16:45 turnaround (`<REF-ALUMNI>`) · 22:00–24:00 outside operating hours | 08:00–09:30 · 12:30–13:45 · 16:45–22:00 |
| Tue 8 Dec | 00:00–08:00 outside · 09:00–13:00 Maintenance, `Stage lighting rewiring` · 22:00–24:00 outside | 08:00–09:00 · 13:00–22:00 |
| Wed 9 Dec | 00:00–08:00 outside · 18:00–24:00 Renovation, `Seat replacement` · 22:00–24:00 outside | 08:00–18:00 |
| Thu 10 Dec | 00:00–12:00 Renovation, `Seat replacement` · 00:00–08:00 outside · 22:00–24:00 outside | 12:00–22:00 |
| Fri 11 Dec | 00:00–08:00 outside · 22:00–24:00 outside. The released lecture slot and the removed fire drill don't appear. | 08:00–22:00 |
| Sat 12 Dec | 00:00–09:00 outside · 15:00–17:00 **confirmed**, 17:00–18:00 turnaround (`<REF-WORKSHOP>`), no setup row · 18:00–24:00 outside | 09:00–15:00 |
| Sun 13 Dec | 00:00–24:00 outside operating hours (closed) | none |

A booking or block that overlaps the hours outside opening is listed as itself and the
outside-hours row is listed too, so Wednesday's evening shows both rows.

## I1 approval statement (I1-T8)

What M1's approval will do to a slot.

~~~sql
update venue.venue_slots set status = 'CONFIRMED', updated_at = now()
where reference = 'I1-FX-ALUMNI' and status = 'HELD'
  and venue_id in (select id from venue.venues where created_by = '00000000-0000-0000-0000-000000000003');
~~~

## I1 release statement (I1-T9)

What a rejection (M2), a withdrawal or a release (L5) will do to a slot.

~~~sql
update venue.venue_slots set status = 'RELEASED', updated_at = now()
where reference = 'I1-FX-SYMPOSIUM' and status = 'CONFIRMED'
  and venue_id in (select id from venue.venues where created_by = '00000000-0000-0000-0000-000000000003');
~~~
