# EN-15-T6 — The web app reads evaluated flags from a small authenticated, rate-limited endpoint

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-15-T6 |
| Test Scenario | The web app reads evaluated flags from a small authenticated, rate-limited endpoint |
| Pre-conditions | 1. Throwaway Postgres (CI) and the app with stubbed sign-in. |
| Test Steps | 1. GET /api/v1/feature-flags without a token.<br>2. GET it as a signed-in coordinator with the flag on, then off.<br>3. Send more requests than the limiter allows. |
| Test Data | Role: EVENT_COORDINATOR. |
| Expected Result | Without a token: 401. Signed in: 200 with { flags: { change-approval: true or false } } matching the flag. Past the limit: 429 RATE_LIMITED. |
| Acceptance criterion | Frontend gets the flag from the server, which stays the real control. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | GET /api/v1/feature-flags: 401 without a token; 200 { flags: { change-approval } } matching the flag, evaluated with the caller's id and role; a tight limiter gives 429 RATE_LIMITED before authentication; an identity failure reaches the error handler. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: backend/services/planning-core/tests/change/api/en15Cards.test.ts › EN-15-T6 and change/api/featureFlags.unit.test.ts › EN-15-T6 tests, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
