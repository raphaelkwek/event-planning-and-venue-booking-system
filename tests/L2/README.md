# L2 — Withdraw a pending booking request

Six cases, written from the story on 17 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`) and the requests L1 raises.

| Acceptance criterion | Cases |
|---|---|
| Only the assigned coordinator for the event can withdraw that event's pending request | L2-T2 |
| Withdrawal is available only while the request is Pending; approved or rejected requests offer no withdraw action | L2-T3 |
| On withdrawal the status becomes Withdrawn and the acting user and timestamp are recorded; the record is retained | L2-T1 |
| The withdrawn request no longer appears in the Venue Staff queue or as pending on the calendar | L2-T4, L2-T5 |
| Withdrawal does not change the event's status | L2-T6 |

L1-T9 also withdraws one of an event's two requests and checks the other is untouched (CR-03).

## L2 decision statement (L2-T3)

Approving and rejecting are M1 and M2: `venuestaff@connectsphere.test` does either from "Booking
requests". The statement comes in two forms, one per decision. Each decides a pending request the
same way in SQL, as `venuestaff@`, recording who and when, as migration venue/0007 requires.
Replace `<REFERENCE>`.

Until 18 Oct 2026 it was a single update that set `<STATUS>` alone. Migration venue/0007 refuses
that now, because an approval must name its booking and a rejection its reason.

**Approve** (this also confirms the booking, as M1 does):

~~~sql
with request as (
  select id, venue_id, event_id, reference, starts_at, ends_at from venue.booking_requests
  where reference = '<REFERENCE>' and status = 'PENDING'
    and venue_id in (select id from venue.venues where created_by = '00000000-0000-0000-0000-000000000003')
), booking as (
  insert into venue.venue_slots (venue_id, event_id, reference, starts_at, ends_at, status, created_by, updated_by)
  select venue_id, event_id, reference, starts_at, ends_at, 'CONFIRMED',
         '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000003'
  from request
  returning id
)
update venue.booking_requests r
set status = 'APPROVED', decided_by = '00000000-0000-0000-0000-000000000003', decided_at = now(),
    booking_id = booking.id, updated_at = now(), updated_by = '00000000-0000-0000-0000-000000000003'
from request, booking
where r.id = request.id;
~~~

**Reject:**

~~~sql
update venue.booking_requests
set status = 'REJECTED', decided_by = '00000000-0000-0000-0000-000000000003', decided_at = now(),
    rejection_reason = 'Set by the L2 decision statement', updated_at = now(),
    updated_by = '00000000-0000-0000-0000-000000000003'
where reference = '<REFERENCE>' and status = 'PENDING'
  and venue_id in (select id from venue.venues where created_by = '00000000-0000-0000-0000-000000000003');
~~~

## L2 assignment statement (L2-T6)

FX-SEEDED's event has no coordinator, so this assigns one. Replace `<EVENT_ID>` and
`<COORDINATOR_ID>` (from the Accounts table in `tests/README.md`).

~~~sql
insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
values ('<EVENT_ID>', '<COORDINATOR_ID>', 'TEST', '<COORDINATOR_ID>', '<COORDINATOR_ID>');
~~~
