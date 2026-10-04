# H1-T10 — Technical Support Staff cannot update a venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T10 |
| Test Scenario | Technical Support Staff cannot update a venue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; note the venue's id.<br>3. Signed in as `techsupport@connectsphere.test`. |
| Test Steps | 1. Open "API console". Send `PUT /venue/api/v1/venues/<id>` with the standard venue as the body, but with `"maxCapacity": 999`.<br>2. Click "Venues". |
| Test Data | Account: `techsupport@connectsphere.test` |
| Expected Result | The response is `403` with code `ROLE_NOT_AUTHORISED`. "Venues" still shows the maximum capacity as 300. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
