# H3-T7 — An Event Coordinator cannot change setup or turnaround time

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T7 |
| Test Scenario | An Event Coordinator cannot change setup or turnaround time |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; note the venue's id.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open "API console". Send `PUT /venue/api/v1/venues/<id>` with the standard venue as the body plus `"setupMinutes": 60`.<br>2. In the SQL editor run: `select setup_minutes from venue.venues where id = '<id>';` |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The response is `403` with code `ROLE_NOT_AUTHORISED`. The setup time is still 0. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The PUT returned 403 ROLE_NOT_AUTHORISED; the setup time was still 0. |
| Status | Pass |
| Remarks | Commit: 6514ab8 · Evidence: tests/H3/evidence/H3-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
