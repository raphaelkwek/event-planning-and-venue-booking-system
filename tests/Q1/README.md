# Q1 — Reserve equipment for an event

Fourteen cases, written from the story (SPM-50) on 15 Oct 2026, before the code. T1 to T13 are API-level procedures (HTTP
requests with authentication stubbed, against a migrated throwaway Postgres), automated one test per card. T13 is the race
case and runs through `reserveLine` in `tests/race/invariants.test.ts` on CI's throwaway Postgres only. T14 is the signed-in
browser walk-through, done by hand.

| Acceptance criterion | Cases |
|---|---|
| A reservation records the event, equipment type, quantity reserved, start and end, the acting staff member and the timestamp; the line's status becomes Reserved | Q1-T1, Q1-T2, Q1-T3, Q1-T9, Q1-T10, Q1-T12, Q1-T14 |
| The reservation is atomic with the availability check: two simultaneous reservations for overlapping periods with one unit left, exactly one succeeds | Q1-T13 |
| The unsuccessful attempt creates no reservation, changes no quantity, and names insufficient availability and the shortfall | Q1-T5 |
| After a reservation, the available quantity for any overlapping period drops by exactly the quantity reserved | Q1-T1, Q1-T2, Q1-T4, Q1-T12 |
| A quantity below the requested one may be reserved only when explicitly chosen; the reservation records the quantity actually reserved | Q1-T6, Q1-T7, Q1-T14 |
| Reserving more than the available quantity is refused; no partial reservation is silently created | Q1-T4, Q1-T5, Q1-T8 |

Only Technical Support reserves (Q1-T11). Only Confirmed and Substituted lines can be reserved (Q1-T3, Q1-T9). Boundaries:
exactly the available quantity (T4) and one above it (T5); quantity 0 and 2.5 (T8).

## What Q1 does not do

Releasing a reservation is Q2 (SPM-51). A line has one reservation; the period is always the line's own window; Technical
Support enters no dates. The coordinator's notification (Q1-T10) is not an acceptance criterion; it keeps "every status
change notifies the coordinator" true.

## Why the cards are API-level and automated

As `tests/O2/README.md`: the behaviour is in the server (the availability check, the locking, the stored rows), so each card
sends real HTTP requests to the real Express app against a real migrated Postgres, with only authentication stubbed. The
browser case Q1-T14 covers what the API cards cannot: the Reserve form, the confirmation checkbox and the coordinator's view.

## Fixture FX-Q1 (API level)

- Actors: TS (Technical Support), C1 (the assigned coordinator), ORG (the event's owner), VS (Venue Staff), ATT (Attendee).
- Event E1: Approved, owned by ORG, assigned to C1, proposed `D 14:00`–`D 18:00` UTC. D is sixty days ahead, as
  `tests/support/eventDates.ts`.
- Equipment types: CHAIRS, bulk, total 10. PROJECTORS, serialized, units `P-01`, `P-02`, `P-03`.
- Every line's window is E1's window.
- "An existing reservation made for another event" means a reservation on a line of a second Approved event with the same
  window, unless the card gives a different window.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied, authentication stubbed: the signed-in user is whichever actor a step
names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-Tn '`

(the trailing space matters, so `Q1-T1 ` does not match `Q1-T10 `). Q1-T13 is in `tests/race/invariants.test.ts` and runs on
CI's throwaway Postgres only; it skips itself elsewhere. Q1-T14 is done by hand in the app, following `tests/README.md`.
Integration cards fail locally until the team migrates the shared database after merge; that is expected.
