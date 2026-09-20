# B1-T4 — A submitted request appears in the coordinator review queue

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T4 |
| Test Scenario | A submitted request appears in the coordinator review queue |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | A row shows the noted reference, name "Annual Research Symposium" and status "Submitted". |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | EVT-001884, “Annual Research Symposium”, and status Submitted appeared in the coordinator review queue. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B1/evidence/B1-T4-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |