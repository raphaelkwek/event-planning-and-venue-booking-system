# L3 — Place a tentative hold on a venue

Seventeen cases, written from the story on 19 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`) and the fixtures below.

| Acceptance criterion | Cases |
|---|---|
| Week 9 answer (CQ-06): only the assigned coordinator requests a hold, for an event not Completed, Cancelled or Rejected, choosing the reminder lead time; Venue Staff of the venue place it and set its expiry; a request reserves nothing | L3-T1, L3-T2, L3-T3, L3-T4, L3-T5, L3-T7 |
| A hold records the venue, date, start and end time, the event, the holding coordinator, the request time, who placed it, when, and the expiry | L3-T1, L3-T5 |
| At most one active hold or confirmed booking per venue and period; a refusal names the conflicting reference and period | L3-T8 |
| CR-01: the overlap check uses occupied periods, with setup and turnaround (H3) | L3-T9 |
| First come, first served, counted from placement; no override | L3-T10, L3-T17 |
| CR-03: at most one active hold per venue per event | L3-T11 |
| A held period shows as held on the calendar, labelled with the event reference, and the venue is left out of search for that period | L3-T12 |
| A hold converts into a booking request for the same venue and period, without re-checking availability, and is superseded by it; withdrawing that request releases the period | L3-T13, L3-T14 |
| The holding coordinator releases a hold; the record is kept as Released and the period is free again | L3-T15 |
| A hold creates no confirmed booking and doesn't let the event become Confirmed | L3-T16 |
| CR-04: every placed hold has an expiry later than the moment it is placed | L3-T6 |

**Not covered here, and why.** Releasing a hold when its event is cancelled is F4's release run
(Sprint 4); L3 provides the release it will call. Approving (M1) or rejecting (M2) a converted
hold's request confirms or releases the held period; those cases belong to M1 and M2, whose
branches aren't merged yet. Expiring, reminders and extending the expiry are L6.

## How a hold works

1. The event's assigned coordinator **requests** a hold: a venue, a date, a start and end time, and
   how many minutes before the expiry to be reminded (at least 1). The hold is **Requested** and has
   a reference, `HLD-` and six digits. It reserves nothing yet.
2. A Venue Staff member who looks after the venue sees it under **Hold requests** and **places**
   it, choosing the expiry date and time. Placing takes the period: the hold becomes **Held**. If
   the period's occupied time (with the venue's setup and turnaround) overlaps another hold or a
   confirmed booking at the venue, placing is refused, naming the other one, and the hold stays
   Requested. Whoever is placed first keeps the period.
3. The coordinator then either **converts** the Held hold into a booking request (L1) or
   **releases** it. A converted hold is **Converted**; its period stays held, now under the
   request's `BKR-` reference, until Venue Staff decide the request (M1, M2) or the coordinator
   withdraws it (L2), which releases the period. A released hold is **Released**.

## FX-HOLD-RIVAL (L3-T10)

A second Approved event, assigned to `coordinator2@connectsphere.test`, on the same date as
FX-BOOKING's event.

1. The FX-SEEDED statement (`tests/README.md`) with `<STATUS>` = `'APPROVED'` and
   `<END>` = `timestamptz '2026-12-02 18:00+08'`. Note its **id** and **reference**.
2. The L2 assignment statement (`tests/L2/README.md`) with that id and
   `00000000-0000-0000-0000-000000000008`.

## FX-HOLD-STATUS (L3-T3, L3-T16)

Sets FX-BOOKING's event to a status no user action reaches yet. Replace `<EVENT_ID>` and `<STATUS>`.

~~~sql
update event.events set status = <STATUS>, updated_at = now() where id = '<EVENT_ID>';
~~~

## Looking a hold up (several cases)

~~~sql
select h.reference, h.status, h.requested_by, h.requested_at, h.placed_by, h.placed_at, h.expires_at,
       h.reminder_lead_minutes, s.reference as slot_reference, s.status as slot_status
from venue.holds h left join venue.venue_slots s on s.id = h.slot_id
where h.event_id = '<EVENT_ID>'
order by h.requested_at;
~~~
