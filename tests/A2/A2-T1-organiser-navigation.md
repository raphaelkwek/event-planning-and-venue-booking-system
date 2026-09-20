# A2-T1 — An organiser's navigation offers only organiser functions

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T1 |
| Test Scenario | An organiser's navigation offers only organiser functions |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Read the navigation bar in the header. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The navigation shows exactly "My requests", "New request" and "API console". There is no "Review queue". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The navigation showed exactly: My requests, New request, API console. No "Review queue". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A2/evidence/A2-T1.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
