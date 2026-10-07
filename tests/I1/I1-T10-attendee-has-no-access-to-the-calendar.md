# I1-T10 — An attendee cannot reach the availability calendar, on screen or through the API

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T10 |
| Test Scenario | An attendee cannot reach the availability calendar, on screen or through the API |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CALENDAR completed. Note the venue's id.<br>3. Signed in as `attendee@connectsphere.test`. |
| Test Steps | 1. Look for "Venues" in the navigation.<br>2. Go to `http://localhost:5173/#/venues/<venue id>/availability`.<br>3. Open the API console. Send `GET /venue/api/v1/venues/<venue id>/availability?from=2026-12-07&to=2026-12-13`. |
| Test Data | Account: `attendee@connectsphere.test` / `ConnectSphere-Test-1234!` · The venue's id |
| Expected Result | There is no "Venues" link. The address shows the attendee's own landing screen, with no calendar and no venue data. The API returns `403` with code `ROLE_NOT_AUTHORISED` and no availability data. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
