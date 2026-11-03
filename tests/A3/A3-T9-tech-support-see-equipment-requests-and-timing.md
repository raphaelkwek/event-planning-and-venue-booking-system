# A3-T9 — Technical Support Staff see equipment requests, reservations and the event timing they depend on

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T9 |
| Test Scenario | Technical Support Staff see equipment requests, reservations and the event timing they depend on |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. An event with an equipment request and a reservation. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `techsupport@connectsphere.test`.<br>2. Open the equipment requests list.<br>3. Open the request. |
| Test Data | Account: `techsupport@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The equipment request and reservation are listed with the event's date, start and end time, and not the full internal event record. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

> **Deferred 2026-09-20 to O1 (Sprint 2) and Q1 (Sprint 3).** Nothing in this case can be split off
> and run now: equipment requests and reservations are Equipment Service records, and that service
> does not exist. Re-read this case when Q1 lands.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Technical Support's equipment requests listed the reserved line and the requested line with the event reference, quantity, start and end and `Reserved 5 of 5`; opening the request showed its update panel; the event name, purpose, description and accessibility needs appeared nowhere. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/e-access-and-console.spec.ts › A3-T9 Technical Support see equipment requests, reservations and the event timing they depend on, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
