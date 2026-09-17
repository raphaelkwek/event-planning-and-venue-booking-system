# D2-T7 — The organiser is notified that clarification is required

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T7 |
| Test Scenario | The organiser is notified that clarification is required |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the reference and says clarification is required. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Blocked |
| Remarks | Blocked: the Notification service (T2) does not exist yet. The Event service writes this notification to its outbox, but nothing delivers it to a user. |
| Executed By | |
| Date of Execution | |
