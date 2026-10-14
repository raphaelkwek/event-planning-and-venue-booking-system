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
| Actual Result | For EVENT_ORGANISER, VENUE_STAFF, TECH_SUPPORT_STAFF and ATTENDEE, GET /api/v1/venues/search (and /search/options and /search/prefill) returned 403 ROLE_NOT_AUTHORISED with no items. A signed-in EVENT_COORDINATOR received 200 with an items list in the empty-search test. The absence of the 'Find a venue' navigation link was not exercised. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/api/venueSearch.test.ts › refuses %s and returns no venues (policy action search on venue; J1-T24) ; backend/services/planning-core/tests/venue/api/venueSearch.test.ts › lists every active venue for an empty search, with the row fields J2 shows , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — · The screen itself was not exercised; UI walk-through in Chrome pending at the sprint review |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
