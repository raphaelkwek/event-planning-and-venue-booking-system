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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
