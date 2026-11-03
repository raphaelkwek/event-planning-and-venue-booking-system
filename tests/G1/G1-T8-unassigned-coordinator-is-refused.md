# G1-T8 — A coordinator who isn't assigned to the event can't edit it, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T8 |
| Test Scenario | A coordinator who isn't assigned to the event can't edit it, and nothing is stored |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed. Note its id, and which coordinator its "Assigned coordinator" field names.<br>3. Signed in as the *other* seeded coordinator. |
| Test Steps | 1. Look for the request in "All events".<br>2. Open the API console and send `PATCH /event/api/v1/events/<id>` with body `{"purpose": "Not mine to change"}`.<br>3. In the SQL editor, read its purpose and count its field-change history. |
| Test Data | Account: whichever of `coordinator@connectsphere.test` / `coordinator2@connectsphere.test` is not assigned |
| Expected Result | The request is not listed. The API returns `404` with code `EVENT_NOT_FOUND` and "No event with that reference is assigned to you.". The purpose is still `Share faculty research`, with no field-change history. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** A coordinator who isn't assigned no longer sees the event, and the API answers 404 as for an unknown event.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-02; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
