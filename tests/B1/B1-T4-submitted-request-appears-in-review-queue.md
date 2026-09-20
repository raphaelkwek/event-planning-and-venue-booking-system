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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The queue row read: EVT-001712Annual Research Symposium12/2/2026, 2:00:00 PM150Organiser One9/20/2026, 3:24:57 PMSubmittedYouOpen |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/B1/evidence/B1-T4.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
