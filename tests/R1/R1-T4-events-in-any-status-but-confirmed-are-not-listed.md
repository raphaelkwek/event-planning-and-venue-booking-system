# R1-T4 — Negative: events that are Draft, Submitted, Under Review, Approved, Planning, Safety Review, Rejected, Cancelled or Completed do not appear, even with registration open

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T4 |
| Test Scenario | Negative: events that are Draft, Submitted, Under Review, Approved, Planning, Safety Review, Rejected, Cancelled or Completed do not appear, even with registration open |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run once per status in Test Data, each named `R Status <STATUS>`, with registration open.<br>3. FX-R-EVENT run once more with its defaults (Confirmed).<br>4. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events".<br>2. Look for every `R Status …` event. |
| Test Data | Statuses: `DRAFT`, `SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `PLANNING`, `SAFETY_REVIEW`, `REJECTED`, `CANCELLED`, `COMPLETED` |
| Expected Result | Only `R Test Symposium` (Confirmed) is listed. None of the nine `R Status …` events appears. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven by backend/services/registration/tests/api/r1Cards.test.ts › R1-T4 lists no event in any status but Confirmed, even with registration open (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 (commit 4f9ab08). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
