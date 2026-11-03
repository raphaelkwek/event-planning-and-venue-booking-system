# R3-T1 — Happy path: My registrations lists each of my registrations with the event name, date, time, venue location, status and registration timestamp

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T1 |
| Test Scenario | Happy path: My registrations lists each of my registrations with the event name, date, time, venue location, status and registration timestamp |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run twice: `R Test Symposium` and `R Second Talk` (`<SEATS>` = 3 each).<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. Register for both (R2-T1 steps 1–2), then withdraw from `R Second Talk` (R4-T1). |
| Test Steps | 1. Click "My registrations". |
| Test Data | Two registrations: one Registered, one Withdrawn |
| Expected Result | Both are listed. Each row shows the event name, `Wednesday 16 December 2026, 14:00–18:00`, `School of Computing, Level 1`, a status (`Registered` for R Test Symposium, `Withdrawn` for R Second Talk) and `Registered <day>, <time>`. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r3Cards.test.ts › R3-T1 R3-T5 lists each of my registrations, newest first, with the event's name, times, venue location, status and timestamps (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
