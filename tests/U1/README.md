# U1 — Conduct an Operational Safety Check

16 cases, written from the story (U1, CR-06 and the Week 9 answers CQ-08, CQ-10, W9-31/32/33/64/65) on 2 Nov 2026, before the code.
U1-T17 was written on 4 Nov 2026 for the team's decision D-02 (`documentation/clarifications.md`), before its code, and is API-level like T1 to T15.
T1 to T15 are API-level procedures, automated one test per card against a migrated throwaway Postgres with authentication stubbed;
T16 is the signed-in browser walk-through, done by hand at the sprint review.

| Acceptance criterion | Cases |
|---|---|
| F5 moves the event to Safety Review and it appears in the queue; it cannot be Confirmed until the Safety Officer approves | U1-T1, U1-T2 |
| The review shows attendance, each venue's capacity and layout, accessibility and equipment with placement notes (CQ-10: no new venue fields) | U1-T3 |
| One decision: approve, request changes or reject; a reason is required for the last two | U1-T4, U1-T8, U1-T15 |
| Approve records the check as passed; the event stays in Safety Review until the assigned coordinator marks it Confirmed, which only a passed check allows | U1-T2, U1-T4, U1-T5, U1-T6 |
| Request changes returns the event to Planning with the changes recorded and the named arrangements flagged; after rework it passes F5 and the check again | U1-T7, U1-T10 |
| Reject (CQ-08) returns the event to Planning as a rejection of the arrangement as a whole; the event is not rejected or cancelled and its arrangements stay | U1-T9 |
| Events confirmed before the feature are not reviewed | U1-T11 |
| Each decision records officer, time, decision and reason, writes F1 history and notifies the assigned coordinator and owning organiser | U1-T4, U1-T12 |
| Only the Safety Officer can decide (A2) | U1-T13 |
| Approval refuses while S3 flags are outstanding (commit 259050d) | U1-T14 |
| Screens: queue, review with its decision form, Mark Confirmed | U1-T16 |
| D-02 (team decision, 4 Nov 2026): every active Safety Officer is told when an event enters Safety Review | U1-T17 |

## Fixture FX-U1

Event E1 in Safety Review, owned by ORG, assigned to C1, `D 14:00`-`D 18:00` UTC, expected attendance 120, accessibility
needs "Step-free access to the main hall"; booking B1 (Confirmed, venue V1 `U1 Hall`, layouts Theatre 150 and Banquet 80, booked Theatre);
reservation R1 (`U1 Chairs` × 5, line note "Rows along the north wall"). Actors: SO the Safety Officer, C1 the assigned coordinator, C2 another
coordinator, ORG the owner, VS Venue Staff, TS Technical Support, ATT an attendee, LEAD the Coordinator Lead.

## What to read after each step

- **Event:** `select status from event.events where id = '<E1>'`.
- **Latest history entry:** `select previous_status, new_status, actor_user_id, actor_role, triggering_action from event.event_history where event_id = '<E1>' and entry_type = 'STATUS_CHANGE' order by occurred_at desc limit 1`.
- **Decisions:** `select decision, reason, decided_by, decided_at from event.safety_decisions where event_id = '<E1>'`.
- **Flags:** `select flag, reason from venue.arrangement_flags where event_id = '<E1>'` and `select flag, reason from equipment.reservation_flags where event_id = '<E1>'`.
- **Outbox:** `select envelope from event.outbox where message_key = '<E1>'`.

"Nothing written" means all of these read exactly as before the request.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied, authentication stubbed. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/change/api/u1Cards.test.ts -t 'U1-Tn '`

The trailing space matters. U1-T16 is done by hand in the app.
