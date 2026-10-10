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
| Actual Result | As coordinator2@connectsphere.test (not assigned), the page offered no "Edit details". The API returned 403 ROLE_NOT_AUTHORISED: "Only the owning organiser or the assigned coordinator can edit this event's details." The purpose stayed "Share faculty research", with no field-change history. |
| Status | Pass |
| Remarks | Commit: c1aa0cb · Evidence: tests/G1/evidence/G1-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-10 |
