# E3-T7 — A coordinator's review queue leaves out unassigned requests, and opening one does not claim it for review

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T7 |
| Test Scenario | A coordinator's review queue leaves out unassigned requests, and opening one does not claim it for review |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed. Note its id. |
| Test Steps | 1. Sign in as `coordinator@connectsphere.test` and open the review queue.<br>2. Open `#/review/<id>`.<br>3. Read the request's status and reviewer in the SQL editor. |
| Test Data | The unassigned request |
| Expected Result | The review queue doesn't list the request. Opening it shows it, but its status is still Submitted and no reviewer is recorded. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The review queue didn't list EVT-014887. Opening it showed it, and it is still SUBMITTED with no reviewer. |
| Status | Pass |
| Remarks | Commit: dbf341e · Evidence: tests/E3/evidence/E3-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-27 |
