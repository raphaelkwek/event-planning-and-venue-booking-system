# F3 — Cancel an event

Nine cases, written from the story (SPM-29, revised by the Week 9 answers) on 29 Oct 2026, following the design in
`documentation/superpowers/specs/2026-10-29-f3-f4-cancel-event-design.md` (section 4 is the card table). F3-T1 to F3-T8 are API-level
procedures (HTTP requests with authentication stubbed, against a migrated throwaway Postgres), automated one test per card in
`backend/services/planning-core/tests/change/api/f3Cards.test.ts`. F3-T9 is the signed-in browser walkthrough, done by hand. The
screen's own rules (who sees **Cancel event**, the mandatory reason in its dialog, the Cancelled banner) are also covered by
`frontend/tests/cancelEvent.test.tsx`.

| Acceptance criterion | Cases |
|---|---|
| AC1: the owning organiser or the assigned coordinator cancels, for an event not Completed, Rejected or Cancelled; no deadline | F3-T1, F3-T2, F3-T3, F3-T9 |
| AC2: a reason is mandatory; without it nothing changes | F3-T4, F3-T9 |
| AC3: the status becomes Cancelled, recording the reason, user and time | F3-T1 |
| AC4: the cancelled event stays visible, showing the reason and the date | F3-T5, F3-T9 |
| AC5: a cancelled event cannot be edited or submitted, or have new bookings, reservations or registrations | F3-T6 |
| AC6: the owner, the coordinator, each booked venue's Venue Staff and each reserver are notified | F3-T7, F3-T9 |
| AC7: releasing the arrangements is F4's | F4's cards (`tests/F4/`) |
| AC8 (Week 9, W9-07): a pending change request is closed, saying why, and can no longer be decided | F3-T8, F3-T9 |

## What F3 does not do

F3 on its own releases nothing: F4 (stacked on this branch) releases the bookings, holds, requests and reservations in the same
transaction. The two pull requests should merge together. No registration can be raised or cancelled, since EN-13's registration service
does not exist yet. A submitted event cannot be submitted again, whatever its status, so AC5's "submitted" needs no new check; a
cancelled draft is Cancelled, not Draft, so it cannot be submitted either.

## Routes, messages and codes the cards use

- `POST /api/v1/events/{id}/cancellation` with `{ "reason": "…" }`: Event Organisers and Event Coordinators. 200 `{ event, closedChangeRequest }`;
  400 `VALIDATION_FAILED` (field `reason`); 403 `ROLE_NOT_AUTHORISED` (neither the owner nor the assigned coordinator); 404 `EVENT_NOT_FOUND`
  (outside the caller's scope); 409 `STATUS_TRANSITION_NOT_PERMITTED`; 500 `CANCELLATION_FAILED` (rolled back, nothing changed).
- `GET /api/v1/events/{id}`: now carries `cancellationReason`, `cancelledBy` and `cancelledAt`.
- Status transition `CANCEL`: every status except `COMPLETED`, `REJECTED` and `CANCELLED` → `CANCELLED`.
- Equipment: `POST /api/v1/equipment/request-lines` and `POST /api/v1/equipment/request-lines/{id}/reservation` refuse a cancelled event with
  409 `EVENT_CANCELLED`.
- Change requests: status `CLOSED` with `closedReason` `The event was cancelled.`; S2's decision answers 409 `CHANGE_REQUEST_ALREADY_DECIDED`.
- Outbox message `event.cancelled` on the event topic (none for a cancelled draft, which has no reference and no one else to tell).

## Fixture FX-F3 (API level)

Reusing the seeded accounts in `tests/README.md`:

- Actors: O (`organiser@connectsphere.test`, owns E), C (`coordinator@connectsphere.test`, assigned to E), C2 (`coordinator2@connectsphere.test`,
  an Event Coordinator not assigned), O2 (`organiser2@connectsphere.test`, owns nothing here), VS (`venuestaff@connectsphere.test`, Venue Staff
  of V1) and T (`techsupport@connectsphere.test`).
- Event E: owned by O, assigned to C, status Planning, `D 14:00`–`D 18:00` UTC, marked as needing equipment. D is sixty days ahead, as
  `tests/support/eventDates.ts`.
- Venue V1 with a Theatre layout, capacity 200, looked after by VS; confirmed booking B1 at V1 for E's period.
- A bulk equipment type of 10 chairs; line L1 (5 chairs) reserved in full by T through Q1's route (reservation R1); line L2 (2 chairs)
  Confirmed and not reserved.
- Change request CR: O's Pending request on E, raised through S1's route, proposing expected attendance 160.

## Fixture FX-F3 (browser level, F3-T9)

An Approved request of `organiser@connectsphere.test` (FX-APPROVED in `tests/README.md`), taken to Planning, with a confirmed booking at a
venue looked after by `venuestaff@connectsphere.test`, an equipment line reserved by `techsupport@connectsphere.test`, and a pending change
request raised as in S1-T13.

## Isolated automated setup and execution

A clean throwaway Postgres with every migration applied (including `event/0012`, `event/0013`, `change/0004` and `change/0005`),
authentication stubbed: the signed-in user is whichever actor a step names. Never the shared database (EN-06). Run one card with

`npm test -w @connectsphere/planning-core -- tests/change/api/f3Cards.test.ts -t 'F3-Tn '`

(the trailing space matters). F3-T9 is done by hand in the app, following `tests/README.md`. Integration cards fail locally until the team
migrates the shared database after merge; that is expected.
