# EN-19-T13 — The admission rate and the token's life are configurable, default to the rate EN-18 tests, and refuse nonsense

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T13 |
| Test Scenario | The admission rate and the token's life are configurable, default to the rate EN-18 tests, and refuse nonsense |
| Pre-conditions | 1. Dependencies installed (`npm ci`). No database is needed. |
| Test Steps | 1. Run `npm run test:unit -w @connectsphere/registration`.<br>2. Find the tests named `EN-19-T13` in `backend/services/registration/tests/domain/waitingRoom.test.ts`. |
| Test Data | WAITING_ROOM_ADMIT_PER_SECOND and WAITING_ROOM_TOKEN_TTL_SECONDS unset, set to valid values, and set to 0, -1, 1.5, 'abc' and a value above the maximum |
| Expected Result | Unset: 100 per second and 300 seconds (100 per event keeps five simultaneous high-demand events within the 500 requests per second EN-18 tests). Valid values are used. Each invalid value is refused with a message naming the setting, so the service does not start with it. |
| Acceptance criterion | N is chosen from the tested rate (500 requests per second overall) and configurable. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Unset: 100 a second and 300 s; blank values read as unset; both ends of each range were accepted; 0, -1, 1.5, abc and one above the maximum were refused naming the setting; a signing key under 32 characters was refused. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/domain/waitingRoom.test.ts › EN-19-T13 defaults to 100 admissions a second per event and a 300 second token ; EN-19-T13 treats an empty or blank setting as unset ; EN-19-T13 uses valid settings, including both ends of their range ; EN-19-T13 refuses nonsense, naming the setting, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
