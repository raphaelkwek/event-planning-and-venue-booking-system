# R1-T6 — An event with no places remaining is shown with a Full label and offers no register action

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T6 |
| Test Scenario | An event with no places remaining is shown with a Full label and offers no register action |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (3 seats), then FX-R-TAKEN with `<N>` = 3.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events" and find `R Test Symposium`.<br>2. Click "View event". |
| Test Data | 3 seats, all 3 taken by other attendees |
| Expected Result | The card shows a `Full` label instead of a number of places. The event page shows `Full` and has no "Register" button. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r1Cards.test.ts › R1-T6 shows an event with no places remaining as full (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
