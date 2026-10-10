# G1-T6 — An edit that includes a significant field is refused, directs the user to the change-request process, and stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T6 |
| Test Scenario | An edit that includes a significant field is refused, directs the user to the change-request process, and stores nothing |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed. Note its id.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the API console and send `PATCH /event/api/v1/events/<id>` with the body in Test Data.<br>2. In the SQL editor, run `select purpose, expected_attendance, proposed_start_at from event.events where id = '<id>';` and count its `FIELD_CHANGE` history entries. |
| Test Data | Account: `organiser@connectsphere.test` · Body `{"purpose": "Sneaked in", "expectedAttendance": 400, "proposedStartAt": "2026-12-03T06:00:00Z"}` |
| Expected Result | The API returns `422` with code `CHANGE_REQUEST_REQUIRED`. Its message says these can be changed only through a change request, and `fields` names `expectedAttendance` and `proposedStartAt`. Nothing is stored: the purpose is still `Share faculty research`, attendance 150, the start unchanged, and there is no field-change history. |
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
