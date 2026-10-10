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
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
