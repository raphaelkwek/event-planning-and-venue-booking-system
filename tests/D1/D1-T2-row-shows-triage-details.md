# D1-T2 — Each queue row shows the details a coordinator triages on

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T2 |
| Test Scenario | Each queue row shows the details a coordinator triages on |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the reference. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue". Do not open the request. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | The row shows the noted reference, name "Annual Research Symposium", proposed date and time 2 December 2026, 14:00, expected attendance 150, the submitting organiser "Organiser One", the submission date and time, and status "Submitted". |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The row read: EVT-001729 \| Annual Research Symposium \| 12/2/2026, 2:00:00 PM \| 150 \| Organiser One \| 9/20/2026, 3:27:00 PM \| Submitted \| You \| Open |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D1/evidence/D1-T2.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
