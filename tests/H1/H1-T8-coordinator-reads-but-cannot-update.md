# H1-T8 — An Event Coordinator can read the venue but an update attempt changes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T8 |
| Test Scenario | An Event Coordinator can read the venue but an update attempt changes nothing |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; note the venue's id.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click "Venues" and find `Lee Kong Chian Auditorium`.<br>2. Open "API console". Send `PUT /venue/api/v1/venues/<id>` with the standard venue as the body, but with `"name": "Renamed by a coordinator"`.<br>3. Click "Venues". |
| Test Data | Account: `coordinator@connectsphere.test` · PUT body as described |
| Expected Result | In step 1 the venue is listed, with no "New venue" button and no "Edit" link. In step 2 the response is `403` with code `ROLE_NOT_AUTHORISED`. In step 3 the venue is still named `Lee Kong Chian Auditorium`. |
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
