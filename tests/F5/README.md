# F5 — Confirm an event only when venue and equipment are ready

Twenty-one cases, written from the story (SPM-109, revision 4 with CR-03 and CR-06) on 20 Oct 2026,
before the code. T1 to T20 are API-level procedures: HTTP requests with authentication stubbed,
against a migrated throwaway Postgres, automated one test per card. T16 is `Blocked` until S3 can set
an unsuitable flag. T21 is the signed-in browser walk-through, done by hand. Design:
`documentation/superpowers/specs/2026-10-20-f5-confirm-arrangements-design.md`.

| Acceptance criterion | Cases |
|---|---|
| Confirmation is performed by the assigned Event Coordinator, on an event in status Approved or Planning | F5-T1, F5-T2, F5-T4, F5-T5 |
| Refused unless the event has at least one venue booking and every active venue booking for it is confirmed (L4; CQ-05). A tentative hold (L3) is not sufficient | F5-T6, F5-T7, F5-T8, F5-T9 |
| Refused unless every equipment request line is reserved in full, or the event is marked as requiring no equipment. A partially reserved line is not complete | F5-T3, F5-T10, F5-T11, F5-T12, F5-T13 |
| Both conditions are read live at the moment of confirmation; never a stored or cached readiness value | F5-T17 |
| If either cannot be retrieved, confirmation is refused and nothing is changed | F5-T18 |
| A refusal names which arrangement is outstanding, and for equipment the lines not reserved in full | F5-T6, F5-T7, F5-T8, F5-T10, F5-T12, F5-T13, F5-T14 |
| Refused while any arrangement carries a Requires Reconfirmation or unsuitable flag (I2, S3); the refusal names the flags | F5-T15, F5-T16 |
| On success the status becomes Safety Review; the acting coordinator and timestamp are recorded, with a history entry (F1). Confirmed only on the Safety Officer's approval (U1) | F5-T1, F5-T2, F5-T21 |
| The owning organiser, the Venue Staff of each booked venue and the Technical Support Staff of any reservation are notified | F5-T19 |
| A refused confirmation changes no status, no booking, and no reservation | F5-T20 (and every refusal card) |

**Partitions and boundaries.** Status falls into permitted (Approved, Planning: T1, T2) and every other
status (T4). Venue arrangements fall into none (T6), hold only (T7), confirmed plus not confirmed (T8),
and all confirmed (T1, T9). A reserved line is either below the requested quantity (4 of 5: T10) or
exactly at it (5 of 5: T11). A reservation can't exceed the requested quantity (Q1's check
constraint), so there is no "above". Equipment falls into "marked no equipment" (T3), required with no
lines (T13), and required with lines (T1, T10 to T12).

**CQ-05 is open.** These cases follow AC2 as written: every active booking must be confirmed (T8). If
the customer answers "one is enough", T8's expected result changes to 200.

## Fixture FX-F5 (API level)

- **Actors:** C1 (the assigned coordinator), C2 (a coordinator not assigned), ORG (the event's
  owner), VS (Venue Staff of V1), VS2 (Venue Staff of V2), TS (Technical Support), ATT (Attendee).
- **Event E1:** Approved, owned by ORG, assigned to C1, proposed `D 14:00`–`D 18:00` UTC, equipment
  required. D is sixty days ahead, as `tests/support/eventDates.ts`.
- **Venues:** V1 `F5 Hall`, looked after by VS; V2 `F5 Breakout Room`, looked after by VS2.
- **Booking B1:** a CONFIRMED slot at V1 for E1's window, reference `BKR-…` (as M1 creates it).
- **Equipment:** type `F5 Chairs`, bulk, total 10. Line L1 is `F5 Chairs` × 5 for E1's window, Confirmed, then
  reserved in full (5 of 5) by TS through Q1.

A card that says "without B1" or "L1 only Confirmed" starts from FX-F5 with that part left out.

## What to read after each step

- **Event:** `select status from event.events where id = '<E1>'`.
- **Latest history entry:** `select previous_status, new_status, actor_user_id, actor_role,
  triggering_action, occurred_at from event.event_history where event_id = '<E1>' and entry_type =
  'STATUS_CHANGE' order by occurred_at desc limit 1`.
- **Arrangements:**
  - `select status, requires_reconfirmation from venue.venue_slots where event_id = '<E1>'`;
  - `select status, reserved_quantity from equipment.reservations where event_id = '<E1>'`.
- **Outbox:** `select envelope from event.outbox where message_key = '<E1>'`.

"Nothing written" means all of these read exactly as before the request.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied, and authentication stubbed: the signed-in
user is whichever actor a step names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/change/api/f5Cards.test.ts -t 'F5-Tn '`

The trailing space matters, so `F5-T1 ` does not match `F5-T10 `. F5-T21 is done by hand in the app,
following `tests/README.md`.
