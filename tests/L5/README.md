# L5 — Request a replacement venue for a disrupted booking

Eight cases, written from the story on 19 Oct 2026, before the code. L5 is new with the Week 7
change CR-02: a coordinator whose booked venue becomes unavailable (I2) finds and requests a
replacement in the system, and the event is never cancelled.

| Acceptance criterion | Cases |
|---|---|
| A booking flagged Requires Reconfirmation by an unavailability block (I2) offers its event's assigned coordinator a "find a replacement" action | L5-T1, L5-T2 |
| The replacement search (J1) is pre-filled with the event's requirements and the disrupted booking's period, and excludes venues unavailable for that period | L5-T3 |
| A replacement booking request (L1) is linked to the disrupted booking it replaces; raising it changes nothing on the event | L5-T4 |
| The disrupted booking is kept, still flagged, until the replacement is approved (M1); it is then released with the reason "replaced", and its record is kept | L5-T5 |
| If the replacement is rejected or withdrawn, the disrupted booking stays as it was, still flagged, and another replacement can be requested | L5-T6, L5-T7 |
| A venue becoming unavailable never cancels the event automatically | L5-T8 |

**Where it happens.** The event's "Venue requests" lists its bookings as well as its requests.
A booking an active block disrupts shows the block and, to the assigned coordinator, "Find a
replacement". That opens "Find a venue" for the booking's period with the event's requirements;
each venue listed offers "Request this venue", which opens the request form for it, linked to the
booking. Approving, rejecting and withdrawing are M1, M2 and L2, unchanged.

**Which venue replaces.** `Mochtar Riady Hall` fits the event (Theatre, 500), but no Venue Staff
look after it in FX-BOOKING, so a request there can't be decided. Cases that approve or reject a
replacement use `Seminar Room 2-1`, which `venuestaff@` looks after, through the statement below.

## FX-L5

1. **FX-BOOKING** (`tests/L1/README.md`). Note the event's id and reference, and its assigned
   coordinator.
2. The assigned coordinator requests `Lee Kong Chian Auditorium`, Theatre, 2 December 2026
   14:00–18:00, and `venuestaff@connectsphere.test` approves it (M1-T3). Note the booking reference
   and the request's `booking_id`.
3. `venuestaff@connectsphere.test` records unavailability at `Lee Kong Chian Auditorium` from
   2 December 2026 16:00 to 19:00, Maintenance, `Stage rigging inspection` (I2-T6). The booking now
   requires reconfirmation.

## L5 replacement statement

After FX-L5: a replacement request for `Seminar Room 2-1`, Classroom, 2 December 2026 14:00–18:00,
linked to the disrupted booking, raised by the assigned coordinator, as "Request this venue" would.
Replace `<BOOKING_ID>` with the disrupted booking's id and `<COORDINATOR_ID>` with the assigned
coordinator's id (Accounts table, `tests/README.md`). It returns the request's **id** and
**reference**.

~~~sql
insert into venue.booking_requests (
  event_id, venue_id, starts_at, ends_at, layout, expected_attendance, event_starts_at, event_ends_at,
  event_attendance, differs_from_event, replaces_booking_id, requested_by, created_by, updated_by
)
select s.event_id, v.id, s.starts_at, s.ends_at, 'Classroom', e.expected_attendance, e.proposed_start_at,
       e.proposed_end_at, e.expected_attendance, false, s.id, '<COORDINATOR_ID>', '<COORDINATOR_ID>', '<COORDINATOR_ID>'
from venue.venue_slots s
join event.events e on e.id = s.event_id
join venue.venues v on v.name = 'Seminar Room 2-1' and v.created_by = '00000000-0000-0000-0000-000000000003'
where s.id = '<BOOKING_ID>'
returning id, reference;
~~~
