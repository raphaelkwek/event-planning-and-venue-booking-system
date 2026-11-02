# EN-19-T11 — The waiting-room routes are rate limited before the token is checked

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-19-T11 |
| Test Scenario | The waiting-room routes are rate limited before the token is checked |
| Pre-conditions | 1. Dependencies installed (`npm ci`). No database is needed. |
| Test Steps | 1. Run `npm run test:unit -w @connectsphere/registration`.<br>2. Find the tests named `EN-19-T11` in `backend/services/registration/tests/api/waitingRoomLimiter.unit.test.ts`. |
| Test Data | More requests than the budget from one address, with no Authorization header, to the join and the status routes |
| Expected Result | Past the budget the answer is 429 `RATE_LIMITED` in the error envelope, not 401: the limiter runs first. The identity service is never asked about a request the limiter refused. |
| Acceptance criterion | The waiting-room endpoint is rate limited before authentication. |
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
