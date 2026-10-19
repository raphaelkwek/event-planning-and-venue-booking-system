# I1-T15 — A venue that does not exist is refused, and no calendar is shown

## Specification

| Item | Content |
|---|---|
| Test Case ID | I1-T15 |
| Test Scenario | A venue that does not exist is refused, and no calendar is shown |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Go to `http://localhost:5173/#/venues/00000000-0000-0000-0000-00000000dead/availability`.<br>2. Open the API console. Send `GET /venue/api/v1/venues/00000000-0000-0000-0000-00000000dead/availability?from=2026-12-07&to=2026-12-13`. |
| Test Data | Account: `coordinator@connectsphere.test` · Venue id `00000000-0000-0000-0000-00000000dead`, which no venue has |
| Expected Result | The screen shows a refusal saying the venue was not found, and no calendar. The API returns `404` with code `VENUE_NOT_FOUND`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The screen showed "No venue with that id exists." and no calendar. The API returned 404 VENUE_NOT_FOUND. |
| Status | Pass |
| Remarks | Commit: ac840b7 · Evidence: tests/I1/evidence/I1-T15.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-07 |
