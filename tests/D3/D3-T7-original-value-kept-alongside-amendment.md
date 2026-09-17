# D3-T7 — The value as originally submitted is kept in the history alongside the amended value

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T7 |
| Test Scenario | The value as originally submitted is kept in the history alongside the amended value |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed (expected attendance 150); note the request id; sign out.<br>3. Signed in as `organiser@connectsphere.test`, on the request page. |
| Test Steps | 1. Enter the amendment and click "Send response".<br>2. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Amend expected attendance: `200`<br>Query: `select field_name, previous_value, new_value, actor_role from event.event_history where event_id = '<id>' and entry_type = 'FIELD_CHANGE';` |
| Expected Result | The request shows expected attendance 200. The query returns one row: field_name `expectedAttendance`, previous_value `150`, new_value `200`, actor_role `EVENT_ORGANISER`. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
