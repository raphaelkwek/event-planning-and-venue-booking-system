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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Blocked: needs a Confirmed event with an open registration window and the attendee's event list (R1, F5) — neither the attendee surface nor registration exists yet. |
| Status | Blocked |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
