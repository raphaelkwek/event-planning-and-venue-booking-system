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
| Actual Result | The event page showed no review, clarification, coordinator, booking, layout or equipment text. From the API console, GET /registration/api/v1/open-events returned 200 and the event object carried exactly the twelve published fields, with venues carrying only name and location. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/r-registration.spec.ts › R1-T8 internal information is not shown: the page and the API response carry only the published fields, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
