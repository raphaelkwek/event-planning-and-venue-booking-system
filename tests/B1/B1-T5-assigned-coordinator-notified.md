# B1-T5 — The assigned coordinator is notified that a request awaits review

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T5 |
| Test Scenario | The assigned coordinator is notified that a request awaits review |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the reference and says a new event request is awaiting review. |
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
