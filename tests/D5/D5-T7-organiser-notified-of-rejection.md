# D5-T7 — The organiser is notified of the rejection

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T7 |
| Test Scenario | The organiser is notified of the rejection |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-REJECTED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the reference, says the request was rejected, and includes the reason. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Blocked: there is no notifications list to open. T2 (Read and manage my notifications) was planned for Sprint 1 but not built — rejection writes an outbox row, and no notification record, read model or screen exists. |
| Status | Blocked |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
