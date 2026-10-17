# S2 — Review and decide a change request

Twelve cases, written from the story (SPM-58) on 18 Oct 2026, before the code. T1 to T10 are API-level procedures (HTTP
requests with authentication stubbed, against a migrated throwaway Postgres), automated one test per card in
`tests/change/api/s2Cards.test.ts`. T11 is the race case (approve and reject at once, exactly one decision recorded), in
`tests/race/invariants.test.ts`, which runs on CI's throwaway Postgres only. T12 is the signed-in browser walk-through, done by
hand.

| Acceptance criterion | Cases |
|---|---|
| AC1: only the assigned coordinator can decide the request, and only while its status is Pending | S2-T4, S2-T5, S2-T9, S2-T11 |
| AC2: rejection requires a reason; without it the request stays Pending, no decision timestamp is recorded, and no event field changes | S2-T3, S2-T12 |
| AC3: on approval the event's fields are updated to the proposed values, and the event history records for each field the before value, the after value, the deciding coordinator and the timestamp | S2-T1, S2-T12 |
| AC4: on rejection no event field changes and the stored snapshot values remain the event's live values | S2-T2, S2-T12 |
| AC5: the requesting organiser receives a notification of either outcome, including the rejection reason where applicable | S2-T8, S2-T12 |
| AC6: a request that already carries a decision offers no further approve or reject action | S2-T4, S2-T12 |

Three cases are not tied to one criterion. S2-T6 and S2-T7 check that approval re-checks the proposed values and the event's
status under lock and refuses (`CHANGE_REQUEST_NO_LONGER_VALID`) when they no longer hold, while rejection still works. S2-T10
checks that approval bumps the event's version, so a G1 edit based on the old version is refused (412).

## What S2 does not do

Flagging the venue and equipment arrangements an approved change affects is S3. Withdrawing a request and partial approval are
not part of S2. Raising a request is S1.

## Why the cards are API-level and automated

As `tests/S1/README.md`: the behaviour is in the server (the assignment check, the lock, the re-check, the history, the outbox
message), so each card sends real HTTP requests to the real Express app against a real migrated Postgres, with only
authentication stubbed. The browser case S2-T12 covers what the API cards cannot: the Approve and Reject buttons, the reason
dialog, the outcome notices and the organiser's view.

## Fixture FX-S2 (API level)

FX-S2 is FX-S1 (`tests/S1/README.md`) plus:

- Actor C2: an Event Coordinator who is not assigned to E1. The other actors are ORG (owns E1), ORG2, C1 (assigned to E1), TS
  and VS.
- Request CR1: ORG's Pending request on E1, made through `POST /api/v1/events/<E1>/change-requests` with
  `{"reason":"Keynote speaker arrives late","changes":{"proposedStartAt":"D 15:00","expectedAttendance":180}}`. Its snapshots
  are `D 14:00` and 150.
- Event E1 is Approved, owned by ORG, assigned to C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not
  required, venue and equipment requirements null. D is sixty days ahead, as `tests/support/eventDates.ts`.
- Decision calls are `POST /api/v1/change-requests/<CR1>/decision` as C1 unless a step names another actor.
- Times in a card are written `D hh:mm` (UTC on day D). "Now minus 1 day" is computed at the moment it is set.
- "A fresh FX-S2" is a second E1 with its own CR1, for the part of a card that cannot share E1 with an earlier part.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied (including `change/0002` and `change/0003`), authentication stubbed:
the signed-in user is whichever actor a step names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-Tn '`

(the trailing space matters, so `S2-T1 ` does not match `S2-T10 `). The race case is in `tests/race/invariants.test.ts` and runs
on CI's throwaway Postgres only; it skips itself elsewhere. S2-T12 is done by hand in the app, following `tests/README.md`; the
`.env` needs the `KAFKA_*` settings and migrations must be applied, including `change/0002` and `change/0003`. Integration cards
fail locally until the team migrates the shared database after merge; that is expected.
