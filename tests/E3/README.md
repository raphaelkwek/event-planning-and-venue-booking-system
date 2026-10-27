# E3 — Assign incoming requests from the unassigned queue (CR-05)

Eight cases, written from the story on 27 Oct 2026, before the code. E3 replaces E1's automatic
assignment: a submitted request now waits, unassigned, until an Event Coordinator Lead assigns it.
The customer's Week 9 answers confirm that coordinators can't claim an unassigned request and the
Lead doesn't coordinate events (W9-35), and that only Leads see the queue (W9-60). The design is
`documentation/superpowers/specs/2026-10-27-e3-e5-lead-assignment-design.md`.

| Acceptance criterion | Cases |
|---|---|
| A new request is assigned to no coordinator and enters the unassigned queue (replaces E1) | E3-T1, E3-T7 |
| Only the Lead sees the queue: reference, name, proposed date, start and end, attendance, submission time, oldest first | E3-T2 |
| The Lead opens a request and sees its basic information | E3-T3 |
| The Lead assigns exactly one active Event Coordinator; any other choice is refused and stores nothing | E3-T4, E3-T5 |
| The assignment records coordinator, Lead and time; the request leaves the queue | E3-T4 |
| At most one active assignment | E3-T6 |
| The coordinator and the organiser are notified; until then the organiser sees "awaiting assignment" | E3-T1, E3-T4 |
| The Lead is a role of its own under A2 (A4's last criteria, which E3 needs) | E3-T8 |

## The Lead account

`lead@connectsphere.test`, "Lead One", user id `00000000-0000-0000-0000-000000000009`, with the
seeded test password (Accounts table, `tests/README.md`). `npm run seed:auth` creates it, and the
identity seed (`npm run migrate:identity`) gives it the role.

## How the shared fixtures change

FX-SUBMITTED leaves the request unassigned. FX-ASSIGNED, new, assigns it to
`coordinator@connectsphere.test` as the Lead would, and FX-UNDER-REVIEW now starts from FX-ASSIGNED.
Every later fixture is unchanged and builds on these (`tests/README.md`).

FX-ASSIGNED is a statement, not the Lead's screen, so that it notifies no one: the cases of other
stories that count notifications (T2) see only their own. E3-T4 assigns through the screen and
checks both notifications. Replace `<EVENT_ID>` with the request's id, and `<COORDINATOR_ID>` with
the coordinator's (Accounts table); the Lead is `lead@connectsphere.test`.

~~~sql
insert into event.assignments (event_id, coordinator_id, assignment_rule, created_by, updated_by)
values ('<EVENT_ID>', '<COORDINATOR_ID>', 'LEAD', '00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000009');
update event.events set version = version + 1, updated_at = now() where id = '<EVENT_ID>';
~~~
