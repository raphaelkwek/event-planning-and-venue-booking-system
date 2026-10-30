# E4 — Reassign an event as the Lead (CR-05)

Eight cases, written from the story on 27 Oct 2026, before the code. The Lead reassigns any live
event to another active Event Coordinator, at once and with no acceptance. Coordinator-to-
coordinator reassignment (E2) is retired with this story (Week 9 item W9-FX-5). The customer's
answers: the Lead is the only route to a reassignment (W9-59), it takes effect immediately with no
acceptance (W9-34, W9-58), and it is allowed at any point, even after the arrangements are
confirmed (W9-20). The design is `documentation/superpowers/specs/2026-10-27-e3-e5-lead-assignment-design.md`.

| Acceptance criterion | Cases |
|---|---|
| The Lead can reassign any event not Completed, Cancelled or Rejected to another active Event Coordinator | E4-T1, E4-T3, E4-T8 |
| Reassigning to the coordinator already assigned is refused and creates no history entry | E4-T2 |
| The outgoing assignment is closed with an end time and kept; the new one records the coordinator, the Lead and the time | E4-T1 |
| From then on only the new coordinator can perform coordinator actions | E4-T4 |
| The outgoing and new coordinators and the organiser are notified; the organiser sees the new point of contact | E4-T5 |
| Week 9: coordinators can no longer propose a reassignment; a pending peer proposal is closed, unaccepted; it takes effect at once, even after the arrangements are confirmed | E4-T6, E4-T7, E4-T3 |

## FX-PROPOSAL statement

A pending E2 proposal, as one made before E2 was retired: from the assigned coordinator, Coordinator
One, to Coordinator Two. Replace `<EVENT_ID>` with the request's id.

~~~sql
insert into event.reassignment_proposals (event_id, outgoing_coordinator_id, nominee_coordinator_id, status, created_by, updated_by)
values ('<EVENT_ID>', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000008', 'PENDING',
        '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000002')
returning id;
~~~

## What E4 retires

E2's cases (`tests/E2`) describe the peer flow, which this story retires: they are superseded and
are not rerun. Their cards and records are kept as they are.
