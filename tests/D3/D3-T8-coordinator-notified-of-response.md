# D3-T8 — The coordinator who asked is notified that the organiser has responded

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T8 |
| Test Scenario | The coordinator who asked is notified that the organiser has responded |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed, then the organiser responds with `Answered.`. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Open the notifications list. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A notification names the request and says the organiser has responded. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Blocked: there is no notifications list to open. T2 (Read and manage my notifications) was planned for Sprint 1 but not built — the response writes an outbox row, and no notification record, read model or screen exists. |
| Status | Blocked |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
