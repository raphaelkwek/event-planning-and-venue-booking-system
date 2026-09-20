# D1-T3 — The queue is ordered by submission time, oldest first

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T3 |
| Test Scenario | The queue is ordered by submission time, oldest first |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED with Event name `First in`; wait one minute; FX-SUBMITTED with Event name `Second in`. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The "First in" row appears above the "Second in" row. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "First in" (submitted Sun Sep 20 2026 15:27:03 GMT+0800 (Singapore Standard Time)) appeared at row 1, above "Second in" (submitted Sun Sep 20 2026 15:27:05 GMT+0800 (Singapore Standard Time)) at row 2. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D1/evidence/D1-T3.png · Defect: — |
| Executed By | Chai Yichen |
| Date of Execution | 2026-09-20 |
