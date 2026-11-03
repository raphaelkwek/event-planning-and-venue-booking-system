# EN-19-T7 — Each attendee gets a queue position and an estimated wait, and both fall as time passes

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T7 |
| Test Scenario | Each attendee gets a queue position and an estimated wait, and both fall as time passes |
| Pre-conditions | 1. Dependencies installed (`npm ci`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all` (in CI, the runner's throwaway Postgres, never the shared database). Run from the repository root.<br>2. A high-demand event, the admission rate 1 per second; a clock the test controls. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the test named `EN-19-T7` in `en19Cards.test.ts`. |
| Test Data | Four attendees join in order; their status is read at the start, 2 seconds later and 10 seconds later |
| Expected Result | At the start: the first is admitted at once, and the others are positions 1, 2 and 3 with estimated waits of 1, 2 and 3 seconds. After 2 s the third is admitted with a token and the fourth is position 1 with a wait of 1 s. After 10 s all four are admitted. |
| Acceptance criterion | Each attendee gets a queue position and an estimated wait. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With 1 admission a second: positions 0 (admitted), 1, 2, 3 and waits 0, 1, 2, 3 s at the start; after 2 s the third was admitted and the fourth was position 1, wait 1 s; after 10 s all were admitted; an unknown or malformed id was 404 WAITING_ROOM_ENTRY_NOT_FOUND. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/api/en19Cards.test.ts › EN-19-T7 reports position and estimated wait, falling as time passes || backend/services/registration/tests/domain/waitingRoom.test.ts › EN-19-T7 rounds up to whole seconds and is 0 once the slot has come ; EN-19-T7 is one more than those waiting ahead, and 0 for anyone no longer waiting || backend/services/registration/tests/service/waitingRoom.unit.test.ts › EN-19-T7 gives a new joiner the gate's slot, moves the gate on, and reports position and wait ; EN-19-T7 is null for an id that has no place, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
