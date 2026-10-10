# G1-T8 — A coordinator who isn't assigned to the event can't edit it, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T8 |
| Test Scenario | A coordinator who isn't assigned to the event can't edit it, and nothing is stored |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed. Note its id, and which coordinator its "Assigned coordinator" field names.<br>3. Signed in as the *other* seeded coordinator. |
| Test Steps | 1. Open the request from "All events" and look for "Edit details".<br>2. Open the API console and send `PATCH /event/api/v1/events/<id>` with body `{"purpose": "Not mine to change"}`.<br>3. In the SQL editor, read its purpose and count its field-change history. |
| Test Data | Account: whichever of `coordinator@connectsphere.test` / `coordinator2@connectsphere.test` is not assigned |
| Expected Result | The page offers no "Edit details". The API returns `403` with code `ROLE_NOT_AUTHORISED` and a message that only the owning organiser or the assigned coordinator can edit the event's details. The purpose is still `Share faculty research`, with no field-change history. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
