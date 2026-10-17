# S1 — Request a change after submission

Thirteen cases, written from the story (SPM-57) on 17 Oct 2026, before the code. T1 to T12 are API-level procedures (HTTP
requests with authentication stubbed, against a migrated throwaway Postgres), automated one test per card in
`tests/change/api/s1Cards.test.ts`. T13 is the signed-in browser walk-through, done by hand. A race case (two simultaneous
requests for one event, exactly one recorded) is in `tests/race/invariants.test.ts` and runs on CI's throwaway Postgres only.

| Acceptance criterion | Cases |
|---|---|
| AC1: a change request can be raised by the owning organiser for events with status Submitted or later, excluding Completed, Cancelled and Rejected | S1-T2, S1-T3, S1-T10, S1-T13 |
| AC2: the request records the fields to change, the proposed new value of each, a mandatory reason, the requesting organiser and the timestamp | S1-T1, S1-T5, S1-T7, S1-T8, S1-T12, S1-T13 |
| AC3: a snapshot of the current value of each affected field is stored with the request | S1-T1, S1-T11, S1-T12 |
| AC4: the event's own field values are unchanged while the request is Pending | S1-T1, S1-T11 |
| AC5: a second pending request for the same event is refused, naming the existing pending request | S1-T4, race case |
| AC6: the assigned coordinator receives a notification identifying the event and the fields proposed for change | S1-T9, S1-T13 |
| AC7: a refused request stores nothing and changes no event field | S1-T3, S1-T4, S1-T5, S1-T6, S1-T7, S1-T10, S1-T12 |

Only the six significant fields can be proposed: `proposedStartAt`, `proposedEndAt`, `expectedAttendance`,
`venueRequirements`, `equipmentRequired` and `equipmentRequirements` (S1-T7). Boundaries: attendance 1 and a start one minute
ahead are accepted (S1-T8); attendance 0 and 2.5, a start in the past and an end before the start are refused (S1-T6).

## What S1 does not do

Deciding a request is S2. Withdrawing a request, changing descriptive fields (G1's Edit details) and flagging affected venue and
equipment arrangements (S3) are not part of S1. The event's own row is never written while a request is Pending.

## Why the cards are API-level and automated

As `tests/Q1/README.md`: the behaviour is in the server (the status check, the one-pending rule, the stored snapshots, the outbox
message), so each card sends real HTTP requests to the real Express app against a real migrated Postgres, with only
authentication stubbed. The browser case S1-T13 covers what the API cards cannot: the "Request a change" form, the unchanged-form
message, the pending notice and the coordinator's view.

## Fixture FX-S1 (API level)

- Actors: ORG (Event Organiser, owns E1), ORG2 (another Event Organiser), C1 (Event Coordinator, assigned to E1), TS (Technical
  Support), VS (Venue Staff).
- Event E1: Approved, owned by ORG, assigned to C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150, equipment not
  required, venue requirements and equipment requirements null. D is sixty days ahead, as `tests/support/eventDates.ts`.
- Times in a card are written `D hh:mm` (UTC on day D). "Now minus 1 day", "now plus 1 minute" and "now plus 2 hours" are
  computed at the moment of the request.
- "Events like E1" have the same owner, assigned coordinator and field values, and differ only in the status the card names.
- "A fresh FX-S1" is a second E1 with no change request, for the part of a card that cannot share E1 with an earlier part.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied, authentication stubbed: the signed-in user is whichever actor a step
names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/change/api/s1Cards.test.ts -t 'S1-Tn '`

(the trailing space matters, so `S1-T1 ` does not match `S1-T10 `). The race case is in `tests/race/invariants.test.ts` and runs
on CI's throwaway Postgres only; it skips itself elsewhere. S1-T13 is done by hand in the app, following `tests/README.md`; the
`.env` needs the `KAFKA_*` settings and migrations must be applied, including `change/0001`. Integration cards fail locally until
the team migrates the shared database after merge; that is expected.
