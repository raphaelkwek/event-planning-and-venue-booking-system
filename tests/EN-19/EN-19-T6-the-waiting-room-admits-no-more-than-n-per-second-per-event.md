# EN-19-T6 — The waiting room admits no more than N attendees per second for an event, however many join at once

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T6 |
| Test Scenario | The waiting room admits no more than N attendees per second for an event, however many join at once |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A high-demand event; the admission rate set to 50 per second. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T6` in `en19Cards.test.ts`, and the pure rules in `tests/domain/waitingRoom.test.ts`. |
| Test Data | 500 attendees join in the same instant (50 connections); a second event is joined alongside |
| Expected Result | All 500 get a place; their admission times are at least 20 ms apart; in every one-second window at most 50 are admitted; the last is admitted about 10 seconds after the first; the second event's first attendee is admitted at once (events do not share a queue). |
| Acceptance criterion | A waiting-room endpoint admits N per second per event. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 500 simultaneous joins on a 50 a second event: 500 places, consecutive slots exactly 20 ms apart, at most 50 in any one-second window, the last 9,980 ms after the first; a second event's first joiner was admitted at once. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/api/en19Cards.test.ts › EN-19-T6 admits at most N per second per event when 500 attendees join at once || backend/services/registration/tests/domain/waitingRoom.test.ts › EN-19-T6 admits the first joiner of an idle gate at once, and moves the gate on by one interval ; EN-19-T6 gives a joiner arriving while others wait the gate's slot, one interval after the last ; EN-19-T6 never admits more than N in any second, however many join at the same instant, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
