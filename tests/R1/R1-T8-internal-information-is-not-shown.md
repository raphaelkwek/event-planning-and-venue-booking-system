# R1-T8 — Internal information (review comments, clarification threads, coordinator notes, booking and equipment records) is not shown

## Specification

| Item | Content |
|---|---|
| Test Case ID | R1-T8 |
| Test Scenario | Internal information (review comments, clarification threads, coordinator notes, booking and equipment records) is not shown |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it).<br>2. FX-R-EVENT run with its defaults.<br>3. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Click "Events", find `R Test Symposium` and click "View event".<br>2. Open the API console at `http://localhost:5173/#/console` (attendees reach it by its address; it is not in their navigation), set Method `GET` and Path `/registration/api/v1/open-events`, and click "Send". |
| Test Data | FX-R-EVENT defaults |
| Expected Result | The page shows only the name, description, date, times, venues with their locations, and places remaining. The response's event objects carry only `eventId`, `reference`, `name`, `description`, `startsAt`, `endsAt`, `venues` (each `name` and `location`), `registrationOpensAt`, `registrationClosesAt`, `withdrawalDeadline`, `placesRemaining` and `isFull`: no review comment, clarification, coordinator, booking reference, booking request, layout record or equipment. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Covered by backend/services/registration/tests/api/r1Cards.test.ts › R1-T8 sends only the published fields: nothing internal, no booking, layout, owner or equipment (API level), and the screen in frontend/tests/attendeeRegistration.test.tsx against a stubbed API, not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
