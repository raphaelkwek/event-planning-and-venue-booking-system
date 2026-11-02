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
| Actual Result | With no Authorization header the join and status routes answered 401 inside the budget and 429 RATE_LIMITED (error envelope) from the 241st request; the stand-in authenticator was never asked; a no-op limiter's 429 also came before authentication. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4ed881d330ebe5af9151561254411ba4a5904d55 · Evidence: backend/services/registration/tests/api/waitingRoomLimiter.unit.test.ts › EN-19-T11 refuses with RATE_LIMITED before the token is checked or identity is asked, on both routes ; EN-19-T11 refuses past the budget with RATE_LIMITED before any token is checked, and answers 401 inside it, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41532885735 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
