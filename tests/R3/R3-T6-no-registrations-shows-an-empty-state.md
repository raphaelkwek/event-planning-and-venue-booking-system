# R3-T6 — Boundary: an attendee with no registrations sees an empty state, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T6 |
| Test Scenario | Boundary: an attendee with no registrations sees an empty state, not an error |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. (Attendee One has no registrations after the reset.) |
| Test Steps | 1. Click "My registrations". |
| Test Data | No registrations |
| Expected Result | The page shows `You have no registrations yet.` and a link to "Events". No error is shown. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r3Cards.test.ts › R3-T6 an attendee with no registrations gets an empty list, not an error (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
