# R1-T1 — An event that is Confirmed, with registration enabled and still open, is listed with its name, description, date, times, venue, location and places remaining

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T1 |
| Test Scenario | An event that is Confirmed, with registration enabled and still open, is listed with its name, description, date, times, venue, location and places remaining |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults (Confirmed, registration open, one venue, 3 seats). Note its reference.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events" in the navigation.<br>2. Find the card for `R Test Symposium`.<br>3. Click "View event". |
| Test Data | FX-R-EVENT defaults: name `R Test Symposium`, description `A one-day symposium for the school of computing.`, 16 December 2026 14:00–18:00 (Singapore time), venue `Lee Kong Chian Auditorium`, location `School of Computing, Level 1`, 3 seats |
| Expected Result | The card shows `R Test Symposium`, `A one-day symposium for the school of computing.`, `Wednesday 16 December 2026, 14:00–18:00`, `Lee Kong Chian Auditorium — School of Computing, Level 1` and `3 places remaining`. The event page shows the same values and a "Register" button. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r1Cards.test.ts › R1-T1 lists an open event with its name, description, date, times, venue, location and places remaining (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
