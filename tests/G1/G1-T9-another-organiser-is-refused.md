# G1-T9 — An organiser who doesn't own the event can't edit it, and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T9 |
| Test Scenario | An organiser who doesn't own the event can't edit it, and nothing is stored |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed. Note its id.<br>3. Signed in as `organiser2@connectsphere.test`. |
| Test Steps | 1. Open the API console and send `PATCH /event/api/v1/events/<id>` with body `{"description": "Not my event"}`.<br>2. In the SQL editor, read its description and count its field-change history. |
| Test Data | Account: `organiser2@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The API returns `404` with code `EVENT_NOT_FOUND`, the same as for an event that doesn't exist, because the event is outside this organiser's scope (A3). The description is unchanged, with no field-change history. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The API returned 404 EVENT_NOT_FOUND, as for an event that doesn't exist. The description was unchanged, with no field-change history. |
| Status | Pass |
| Remarks | Commit: c1aa0cb · Evidence: tests/G1/evidence/G1-T9.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-10 |
