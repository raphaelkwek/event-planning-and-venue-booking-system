# D1-T7 — A draft never appears in the review queue

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T7 |
| Test Scenario | A draft never appears in the review queue |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Unfinished idea` completed. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | No row is named "Unfinished idea". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The review queue held no row named "Unfinished idea". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D1/evidence/D1-T7.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
