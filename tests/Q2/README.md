# Q2 — Release an equipment reservation

Thirteen cases, written from the story (SPM-51) on 16 Oct 2026, before the code. T1 to T11 are API-level procedures (HTTP
requests with authentication stubbed, against a migrated throwaway Postgres), automated one test per card. T6 is the race
case and runs through `releaseLine` in `tests/race/invariants.test.ts` on CI's throwaway Postgres only. T12 belongs to F4
(event cancellation) and stays Not Executed until F4 is built. T13 is the signed-in browser walk-through, done by hand.

| Acceptance criterion | Cases |
|---|---|
| A reservation is released when Technical Support release it with a reason, when its request line is cancelled, or when the event is cancelled (F4) | Q2-T1, Q2-T3, Q2-T4, Q2-T7, Q2-T8, Q2-T11, Q2-T12, Q2-T13 |
| On release the reserved quantity returns to the available quantity for the corresponding period | Q2-T1, Q2-T2, Q2-T3, Q2-T8, Q2-T11, Q2-T12 |
| The reservation record is retained with status Released and records the releasing user, timestamp and reason; it is not deleted | Q2-T1, Q2-T8, Q2-T11 |
| Releasing a reservation that is already Released changes no quantity and writes no second release timestamp | Q2-T5, Q2-T6 |
| The assigned coordinator receives a notification when a reservation for their event is released | Q2-T9, Q2-T12, Q2-T13 |

Only Technical Support releases (Q2-T10). Only a Reserved line can be released (Q2-T7). The coordinator can remove a Reserved
line, which releases it (Q2-T8). A reason is required (Q2-T4). Boundaries: a missing, empty and whitespace-only reason (T4);
the second release of the same line (T5); fifty simultaneous releases (T6).

## What Q2 does not do

Cancelling an event is F4: Q2 provides `releaseEventReservations` for F4's transaction, and Q2-T12 waits for F4. There are no
partial releases and no line-history view, and Technical Support is not notified. Reserving is Q1 (SPM-50).

## Why the cards are API-level and automated

As `tests/Q1/README.md`: the behaviour is in the server (the locking, the stored rows, the availability counts), so each card
sends real HTTP requests to the real Express app against a real migrated Postgres, with only authentication stubbed. The
browser case Q2-T13 covers what the API cards cannot: the Release form, the Remove dialog and the coordinator's notifications.

## Fixture FX-Q2 (API level)

FX-Q1 from `tests/Q1/README.md` plus one reserved line:

- Actors: TS (Technical Support), C1 (the assigned coordinator), ORG (the event's owner), VS (Venue Staff), ATT (Attendee).
- Event E1: Approved, owned by ORG, assigned to C1, proposed `D 14:00`–`D 18:00` UTC. D is sixty days ahead, as
  `tests/support/eventDates.ts`.
- Equipment types: CHAIRS, bulk, total 10. PROJECTORS, serialized, units `P-01`, `P-02`, `P-03`.
- Every line's window is E1's window.
- L1: a CHAIRS line (quantity 4) for E1, Confirmed, then reserved by TS through
  `POST /api/v1/equipment/request-lines/<L1>/reservation`. CHAIRS has 6 left.
- Release requests are `POST /api/v1/equipment/request-lines/<id>/release` as TS unless a card says otherwise.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied, authentication stubbed: the signed-in user is whichever actor a step
names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-Tn '`

(the trailing space matters, so `Q2-T1 ` does not match `Q2-T10 `). Q2-T6 is in `tests/race/invariants.test.ts` and runs on
CI's throwaway Postgres only; it skips itself elsewhere. Q2-T12 is Not Executed until F4. Q2-T13 is done by hand in the app,
following `tests/README.md`. Integration cards fail locally until the team migrates the shared database after merge; that is
expected.
