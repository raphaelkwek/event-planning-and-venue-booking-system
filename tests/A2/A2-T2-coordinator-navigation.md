# A2-T2 — A coordinator's navigation offers only coordinator functions

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T2 |
| Test Scenario | A coordinator's navigation offers only coordinator functions |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Read the navigation bar in the header. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The navigation shows exactly "Review queue", "All events" and "API console". There is no "My requests" and no "New request". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The navigation showed exactly: Review queue, All events, API console. No "My requests" and no "New request". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A2/evidence/A2-T2.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
