# G2 — Warn which arrangements a significant change would affect

Eight cases, written from the story (SPM-31) on 29 Oct 2026, before the code, following the design in
`documentation/superpowers/specs/2026-10-29-g2-change-impact-preview-design.md` (section 4 is the card table). G2-T2 to G2-T7 are
API-level procedures (HTTP requests with authentication stubbed, against a migrated throwaway Postgres), automated one test per card
in `backend/services/planning-core/tests/change/api/g2Cards.test.ts`. G2-T1 is a unit test of the web app
(`frontend/tests/significantFields.test.ts`). G2-T8 is the signed-in browser walk-through, done by hand.

| Acceptance criterion | Cases |
|---|---|
| AC1: the list of significant fields is held in one place and used by both the edit screen (G1) and the change-request screens (S1, S2) | G2-T1 |
| AC2: when a change request touches a significant field, the review screen lists the confirmed venue booking, equipment reservations and count of active registrations for the event, read from the booking, reservation and registration records | G2-T2, G2-T6, G2-T7, G2-T8 |
| AC3: for each listed arrangement the screen states specifically why it is affected | G2-T3, G2-T4, G2-T8 |
| AC4: no booking, reservation or registration is altered while the change request is only being viewed | G2-T5, G2-T8 |

Registrations do not exist until EN-13 (registration service), so `impact.activeRegistrations` is always 0, as in S3.

## What G2 does

G2 previews what approving a **Pending** change request would do. It runs S3's assessment (`tests/S3/README.md`) over the event's
current values with the request's proposed values laid over them, so the preview names exactly the flags, with exactly the reasons,
that S3 would set on approval: confirmed bookings, held holds and pending booking requests at the venue, and equipment reservations.
It reads them without locking them, in a read-only transaction, and writes nothing: no flag, no status, no outbox message.

## What G2 does not do

Previewing a decided request (S3 already reported what approval did, so a decided request answers 409), notifying anyone, and
changing what approval does (S3).

## Why the cards are API-level and automated

As `tests/S3/README.md`: the behaviour is in the server (the same assessment S3 applies, the read-only transaction, the visibility
rule), so each card sends real HTTP requests to the real Express app against a real migrated Postgres, with only authentication
stubbed. G2-T5 compares every table the approval would write before and after the preview. The browser case G2-T8 covers what the
API cards cannot: the "If this change is approved" section on the coordinator's review page.

## Route the cards use

- `GET /api/v1/change-requests/{id}/impact`: the owning organiser, the assigned coordinator and Event Coordinators; 404
  `CHANGE_REQUEST_NOT_FOUND` (`No change request with that id exists.`) for anyone else and for an id that does not exist. A Pending
  request answers 200 `{ "impact": { bookings, reservations, activeRegistrations, flags } }`, S3's `impact` shape, where `flags` are
  the flags approval *would* set. A decided request answers 409 `CHANGE_REQUEST_ALREADY_DECIDED`, S2's refusal: the message
  `This change request was already Approved on <decidedAt>.` (or `Rejected`) and `details` `{status, decidedAt}`.
- Flags and reasons are S3's (`tests/S3/README.md`): `REQUIRES_RECONFIRMATION` with
  `The booking is for <period>, but the event is now <period>.`, `FLAGGED_FOR_REVIEW` with
  `The reservation is for <period>, but the event is now <period>.`, and `UNSUITABLE` with
  `Expected attendance is now 150, but <venue> holds 100 in the Theatre layout.` Each period is in Singapore time, as `formatPeriod`
  writes it (`D 14:00`–`D 18:00` UTC on 2 December 2026 reads `Wednesday 2 December 2026 22:00 to Thursday 3 December 2026 02:00`).

## Fixture FX-G2 (API level)

FX-G2 is FX-S3 (`tests/S3/README.md`): O owns event E (Planning, `D 14:00`–`D 18:00` UTC, expected attendance 80), assigned to C;
C2 is an Event Coordinator not assigned to E, O2 an organiser who owns nothing here, VS Venue Staff of V1 and V2, T Technical Support.
V1 `Venue One` has layout "Theatre", capacity 100; V2 `Venue Two` layout "Hall", capacity 200. Confirmed bookings B1 at V1 and B2 at
V2 and reservation R1 (RESERVED, by T) are each for exactly E's period. CR is O's **Pending** change request on E, made through S1's
route, with the changes a card names: "date moved" is `proposedStartAt` `D 15:00`; "attendance 150" is `expectedAttendance` 150.
Preview calls are `GET /api/v1/change-requests/<CR>/impact` as C unless a step names another actor.

## Fixture FX-G2 (browser level, G2-T8)

As S3-T13's (`tests/S3/README.md`): an Approved request of `organiser@connectsphere.test` (FX-APPROVED in `tests/README.md`), taken
to Planning, with two venues whose layouts and capacities are Theatre 100 and Hall 200 (created by `venuestaff@connectsphere.test`), a
confirmed booking at each for the event's period, an equipment reservation for the same period by `techsupport@connectsphere.test`,
and a pending change request raised as in S1-T13 that changes the start time and sets expected attendance to 150.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied (including `venue/0019` and `equipment/0009`), authentication stubbed: the
signed-in user is whichever actor a step names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/change/api/g2Cards.test.ts -t 'G2-Tn '`

and G2-T1 with `npm test -w @connectsphere/web -- tests/significantFields.test.ts`. G2-T8 is done by hand in the app, following
`tests/README.md`; migrations must be applied, including `venue/0019` and `equipment/0009`. Integration cards fail locally until the
team migrates the shared database after merge; that is expected.
