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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Blocked: the coordinator UI has no Notifications list; the notification feature required by this case is not implemented in this build. |
| Status | Blocked |
| Remarks | Commit: b0ef6ee · Evidence: tests/B1/evidence/B1-T5-2026-09-20.png · Defect: — · Blocked because the Notifications/T2 user-facing feature is not implemented. |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |