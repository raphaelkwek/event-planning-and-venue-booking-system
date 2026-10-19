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

Approving and rejecting are M1 and M2. Until they're built, this sets a request's status the way
they will. Replace `<REFERENCE>` and `<STATUS>` (`'APPROVED'` or `'REJECTED'`).

~~~sql
update venue.booking_requests set status = <STATUS>, updated_at = now()
where reference = '<REFERENCE>'
  and venue_id in (select id from venue.venues where created_by = '00000000-0000-0000-0000-000000000003');
~~~

## L2 assignment statement (L2-T6)

FX-SEEDED's event has no coordinator, so this assigns one. Replace `<EVENT_ID>` and
`<COORDINATOR_ID>` (from the Accounts table in `tests/README.md`).

~~~sql
insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
values ('<EVENT_ID>', '<COORDINATOR_ID>', 'TEST', '<COORDINATOR_ID>', '<COORDINATOR_ID>');
~~~
