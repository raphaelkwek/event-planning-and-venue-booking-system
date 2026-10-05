# H2-T6 — An attendee cannot reach the venue catalogue screens

## Specification

| Item | Content |
|---|---|
| Test Case ID | H2-T6 |
| Test Scenario | An attendee cannot reach the venue catalogue screens |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; note the venue's id.<br>3. Signed in as `attendee@connectsphere.test`. |
| Test Steps | 1. Look at the navigation.<br>2. Go to `http://localhost:5173/#/venues/<id>`.<br>3. Open "API console" and send `GET /venue/api/v1/venues/<id>`. |
| Test Data | Account: `attendee@connectsphere.test` |
| Expected Result | Step 1: there is no "Venues" link. Step 2: the venue's page does not open; the attendee's own landing screen shows instead, with no venue data. Step 3: `403` with code `ROLE_NOT_AUTHORISED`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | No "Venues" link. Going to the venue's address showed the attendee's own landing screen (#/console) with no venue data. The API returned 403 ROLE_NOT_AUTHORISED. |
| Status | Pass |
| Remarks | Commit: ca285fa · Evidence: tests/H2/evidence/H2-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-05 |
