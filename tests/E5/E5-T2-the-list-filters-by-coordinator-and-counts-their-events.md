# E5-T2 — The list can be filtered by coordinator, and shows each coordinator's number of active assigned events

## Specification

| Item | Content |
|---|---|
| Test Case ID | E5-T2 |
| Test Scenario | The list can be filtered by coordinator, and shows each coordinator's number of active assigned events |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Two requests assigned to Coordinator One and one to Coordinator Two (FX-ASSIGNED three times), and one Rejected request assigned to Coordinator One (FX-REJECTED).<br>3. Signed in as `lead@connectsphere.test`. |
| Test Steps | 1. Open "Assignments" and read each coordinator's count.<br>2. Choose `Coordinator One` under "Coordinator" and read the list.<br>3. Choose "All coordinators". |
| Test Data | Coordinator One: 2 active and 1 Rejected; Coordinator Two: 1 active |
| Expected Result | Coordinator One shows 2 active events and Coordinator Two 1; the Rejected request isn't counted. Filtered to Coordinator One, the list shows only their two events. With "All coordinators" every active event is listed again. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Counts: Coordinator One: 2 active; Coordinator Two: 1 active; the Rejected request isn't counted. Filtered to Coordinator One the list showed EVT-015376 and EVT-015377 only; with "All coordinators" EVT-015378 was listed again. |
| Status | Pass |
| Remarks | Commit: 742bee5 · Evidence: tests/E5/evidence/E5-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-28 |
