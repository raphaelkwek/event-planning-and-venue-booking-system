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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
