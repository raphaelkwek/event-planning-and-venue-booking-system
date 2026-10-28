# S3 — Reconsider arrangements affected by an approved change

Fourteen cases, written from the story (SPM-59, revised by CR-03 and the Week 9 answers) on 28 Oct 2026, before the code, following the
design in `documentation/superpowers/specs/2026-10-28-s3-change-impact-design.md` (section 5 is the card table). S3-T14 was added on
29 Oct 2026 after review, when holds and pending requests started to be flagged. S3-T1 to S3-T10, S3-T12 and S3-T14 are API-level procedures (HTTP requests with authentication stubbed, against a migrated throwaway Postgres), automated one test
per card in `backend/services/planning-core/tests/change/api/s3Cards.test.ts`. S3-T11 is automated only: the flag writer is forced to
throw inside the test, which cannot be done by hand. S3-T13 is the signed-in browser walk-through, done by hand.

| Acceptance criterion | Cases |
|---|---|
| AC1: on approval the system lists every confirmed booking, every equipment reservation and the active registration count | S3-T1, S3-T5, S3-T12, S3-T13 |
| AC2: a confirmed booking whose period no longer matches is set to Requires Reconfirmation; its period is not moved and the venue is not released | S3-T2, S3-T13, S3-T14 |
| AC3: a reservation whose period no longer matches is flagged for review; nothing is released | S3-T3, S3-T13 |
| AC4: attendance above the booked layout's capacity makes the booking Unsuitable, showing both values | S3-T4, S3-T12, S3-T13 |
| AC5: with several venues each booking is assessed and flagged on its own | S3-T5 |
| AC6: flagging does not change the status of an event that is not Confirmed | S3-T6 |
| AC7: an approved change to a Confirmed event returns it to Planning with its flags | S3-T7 |
| AC8: every outstanding flag is visible to the owner, the assigned coordinator and Event Coordinators, saying which arrangement and why | S3-T8, S3-T13 |
| AC9: F5 confirmation is refused while a flag exists, naming them | S3-T9, S3-T13, S3-T14 |
| AC10: Venue Staff, Technical Support and (later) attendees are notified | S3-T10, S3-T13 |
| AC11: if flagging fails, the change is not applied and no arrangement is altered | S3-T11 |

Attendees are not notified by S3: EN-13 (registration service) is not built, so `impact.activeRegistrations` is always 0.

## Holds and pending requests

Besides confirmed bookings, an approval assesses the event's held holds and pending booking requests by the same rules, since either
can still become a confirmed booking for the old period. A hold's flag is on its slot, which M1 confirms in place; a pending request's
flags are on the request, and M1 copies them, with their reasons, to the booking it confirms (S3-T14). A request converted from a hold
is assessed once, as the hold. S3's Requires Reconfirmation is stored apart from I2's and H3's, so removing a block or a buffer
conflict never clears it.

## What S3 does not do

Clearing a flag, notifying attendees (needs EN-13) and the review-screen preview (G2). Free-text venue and equipment requirements are
listed but never flagged (S3-T12). The period rule compares exactly with the event's new period, so a booking or reservation
deliberately for another window is flagged on any time change; the coordinator judges it.

## Why the cards are API-level and automated

As `tests/S1/README.md`: the behaviour is in the server (the assessment, the flag writes in the same transaction as the approval, the
status transition, the outbox message), so each card sends real HTTP requests to the real Express app against a real migrated Postgres,
with only authentication stubbed. The browser case S3-T13 covers what the API cards cannot: the impact list after approval and the
"Outstanding flags" panel.

## Routes, flags and messages the cards use

- `POST /api/v1/change-requests/{id}/decision` (S2) with `{ "decision": "APPROVE" }`: on approval the 200 also carries `impact`
  (`bookings`, each with its `arrangement`: `BOOKING`, `HOLD` or `BOOKING_REQUEST`; `reservations`, `activeRegistrations`, `flags`).
- `GET /api/v1/events/{id}/arrangement-flags`: owner, assigned coordinator and Event Coordinators; 404 `EVENT_NOT_FOUND` for anyone else.
  Every flag F5 would refuse on, each arrangement and flag once with its newest reason; a Requires Reconfirmation set by I2 or H3 reads
  `The venue's availability changed after this booking was made; Venue Staff must reconfirm it.` (hold, booking request likewise).
- `POST /api/v1/booking-requests/{id}/approve` (M1), as VS: confirms the booking, carrying the request's flags to it (S3-T14).
- `POST /api/v1/events/{id}/confirmation` (F5): 422 `ARRANGEMENTS_NOT_READY` while a flag exists.
- Flags: `REQUIRES_RECONFIRMATION` ("Requires Reconfirmation"), `UNSUITABLE` ("Unsuitable"), `FLAGGED_FOR_REVIEW` ("Flagged for review").
- Reasons: `The booking is for <period>, but the event is now <period>.` (hold, booking request, reservation: `The hold is for …`, `The booking request is for …`, `The reservation is for <period>, but the event is now <period>.`), with each period in Singapore time, as `formatPeriod` writes it (`D 14:00`–`D 18:00` UTC on 2 December 2026 reads `Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 02:00`)
  and `Expected attendance is now 150, but <venue> holds 100 in the Theatre layout.`
- Status transition `RECONSIDER_AFTER_CHANGE`: `CONFIRMED` → `PLANNING`.
- Outbox message `change-request.arrangements-flagged`, written only when something was flagged.

## Fixture FX-S3 (API level)

FX-S3 is FX-S2 (`tests/S2/README.md`) with the following, reusing the seeded accounts in `tests/README.md`:

- Actors: O (`organiser@connectsphere.test`, owns E), C (`coordinator@connectsphere.test`, assigned to E), C2
  (`coordinator2@connectsphere.test`, an Event Coordinator not assigned), O2 (`organiser2@connectsphere.test`, owns nothing here), VS
  (`venuestaff@connectsphere.test`, Venue Staff of V1 and V2) and T (`techsupport@connectsphere.test`).
- Event E: owned by O, assigned to C, proposed `D 14:00`–`D 18:00` UTC, expected attendance 80, status Planning unless a card says
  otherwise ("a fresh FX-S3 whose E is Confirmed" is seeded directly as Confirmed: no route reaches Confirmed yet, since F5 ends in Safety Review). D is sixty days ahead, as
  `tests/support/eventDates.ts`. Times in a card are written `D hh:mm`.
- Venue V1 `Venue One`: layout "Theatre", capacity 100. Venue V2 `Venue Two`: layout "Hall", capacity 200.
- Confirmed bookings B1 at V1 and B2 at V2, each for exactly E's period, each from an approved booking request for E in that venue's
  layout (Theatre, Hall) with attendance 80.
- Equipment reservation R1 (status RESERVED, a quantity of at least 1) for exactly E's period, reserved by T.
- Change request CR: O's Pending request on E, with the changes a card names. "Date moved" means `proposedStartAt` `D 15:00`;
  "attendance 150" means `expectedAttendance` 150.
- Decision calls are `POST /api/v1/change-requests/<CR>/decision` as C unless a step names another actor. "A fresh FX-S3" is a second E
  with its own bookings, reservation and CR, for the part of a card that cannot share E with an earlier part.

## Fixture FX-S3 (browser level, S3-T13)

An Approved request of `organiser@connectsphere.test` (FX-APPROVED in `tests/README.md`), taken to Planning, with two venues whose
layouts and capacities are Theatre 100 and Hall 200 (created by `venuestaff@connectsphere.test`), a confirmed booking at each for the
event's period, an equipment reservation for the same period by `techsupport@connectsphere.test`, and a pending change request raised
as in S1-T13 that changes the start time and sets expected attendance to 150.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied (including `venue/0018` and `equipment/0009`), authentication stubbed: the
signed-in user is whichever actor a step names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/change/api/s3Cards.test.ts -t 'S3-Tn '`

(the trailing space matters, so `S3-T1 ` does not match `S3-T10 `). S3-T13 is done by hand in the app, following `tests/README.md`; the
`.env` needs the `KAFKA_*` settings and migrations must be applied, including `venue/0018` and `equipment/0009`. Integration cards
fail locally until the team migrates the shared database after merge; that is expected.
