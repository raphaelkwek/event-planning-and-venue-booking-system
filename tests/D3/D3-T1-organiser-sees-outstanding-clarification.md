# D3-T1 — The organiser sees the outstanding clarification on their own request

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T1 |
| Test Scenario | The organiser sees the outstanding clarification on their own request |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Click "My requests", then "View" on the request. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "Coordinator asked" shows "Please confirm the expected attendance." with "Awaiting your response", and a "Respond" section is shown. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The request page (EVT-001743) showed "Coordinator asked — Please confirm the expected attendance." with "Awaiting your response" and a "Respond" section. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D3/evidence/D3-T1.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
