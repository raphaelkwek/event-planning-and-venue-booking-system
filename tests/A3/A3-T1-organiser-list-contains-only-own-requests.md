# A3-T1 — An organiser's list contains only the requests they own

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T1 |
| Test Scenario | An organiser's list contains only the requests they own |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. As `organiser2@connectsphere.test`: FX-SUBMITTED with Event name `Organiser two's symposium`.<br>3. As `organiser@connectsphere.test`: FX-SUBMITTED. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "Annual Research Symposium" is listed. "Organiser two's symposium" is not. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "My requests" listed "Annual Research Symposium" (EVT-001702) and did not list organiser two's request. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A3/evidence/A3-T1.png · Defect: — |
| Executed By | Seann Khoo |
| Date of Execution | 2026-09-20 |
