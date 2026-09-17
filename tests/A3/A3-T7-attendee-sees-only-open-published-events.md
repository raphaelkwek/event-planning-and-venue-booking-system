# A3-T7 — An attendee sees only events open to them, and only their published fields

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T7 |
| Test Scenario | An attendee sees only events open to them, and only their published fields |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. One Confirmed event with registration enabled and its registration window open.<br>3. One Approved event that is not open for registration.<br>4. A clarification thread and a coordinator note exist on the open event. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `attendee@connectsphere.test`.<br>2. Open the list of events open for registration.<br>3. Open the open event. |
| Test Data | Account: `attendee@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Only the open event is listed. Its detail shows published fields only — no coordinator notes, review comments, clarification thread or rejection reason. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Blocked |
| Remarks | Blocked: attendee event browsing (R1) and the Registration service are not built, so there is no attendee event list to check. |
| Executed By | |
| Date of Execution | |
