# A1-T2 — Sign in as an Event Coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | A1-T2 |
| Test Scenario | Sign in as an Event Coordinator |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed out: the sign-in screen is showing. |
| Test Steps | 1. Go to http://localhost:5173 and enter the email and password.<br>2. Click "Sign in". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The "Review queue" screen opens. The header shows `coordinator@connectsphere.test · Event Coordinator`. (The role was shown as the code `EVENT_COORDINATOR` until 2026-09-17.) |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Review queue" opened. Header: "coordinator@connectsphere.test · Event Coordinator". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A1/evidence/A1-T2.png · Defect: — |
| Executed By | Seann Khoo |
| Date of Execution | 2026-09-20 |
