# R1-T3 — Negative: a Confirmed event whose registration is not enabled is not listed

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T3 |
| Test Scenario | Negative: a Confirmed event whose registration is not enabled is not listed |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with `<REQUIRED>` = `false` and the name `R No Registration`.<br>3. FX-R-EVENT run again with its defaults.<br>4. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events".<br>2. Look for both events. |
| Test Data | `R No Registration` (Confirmed, registration not required) · `R Test Symposium` (defaults) |
| Expected Result | `R Test Symposium` is listed. `R No Registration` is not listed anywhere on the page. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r1Cards.test.ts › R1-T3 does not list a Confirmed event whose registration is not enabled (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
