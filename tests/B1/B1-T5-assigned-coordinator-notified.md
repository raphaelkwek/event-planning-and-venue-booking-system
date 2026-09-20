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
| Actual Result | Blocked: there is no notifications list to open. T2 (Read and manage my notifications) was planned for Sprint 1 but not built — submission writes an outbox row, and no notification record, read model or screen exists. |
| Status | Blocked |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
