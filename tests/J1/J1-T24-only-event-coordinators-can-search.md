# J1-T24 — Only Event Coordinators can search; every other role is refused by the server

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T24 |
| Test Scenario | Only Event Coordinators can search; every other role is refused by the server |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as each account in turn. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`. Check the navigation for “Find a venue”.<br>2. Open “API console”, set Method `GET`, Path `/venue/api/v1/venues/search`, and click “Send”.<br>3. Repeat steps 1 and 2 as `venuestaff@connectsphere.test`, `techsupport@connectsphere.test` and `attendee@connectsphere.test`.<br>4. Sign in as `coordinator@connectsphere.test` and repeat step 2. |
| Test Data | Accounts: organiser, venue staff, tech support and attendee, then coordinator |
| Expected Result | The first four accounts have no “Find a venue” link. Their requests return 403 with `ROLE_NOT_AUTHORISED`. The coordinator's request returns 200 with an `items` list. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The organiser, Venue Staff, Technical Support and the attendee had no `Find a venue` link and got 403 ROLE_NOT_AUTHORISED from GET /venue/api/v1/venues/search in the API console; the coordinator got 200 with an items list. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/j-venue-search.spec.ts › J1-T24 only Event Coordinators can search; every other role is refused by the server, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |