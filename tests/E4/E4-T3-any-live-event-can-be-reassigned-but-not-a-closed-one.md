# E4-T3 — Any event not Completed, Cancelled or Rejected can be reassigned, including after its arrangements are confirmed; a Completed, Cancelled or Rejected one cannot (partition)

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T3 |
| Test Scenario | Any event not Completed, Cancelled or Rejected can be reassigned, including after its arrangements are confirmed; a Completed, Cancelled or Rejected one cannot (partition) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Four events from the FX-SEEDED statement (`tests/README.md`), with statuses `CONFIRMED`, `COMPLETED`, `CANCELLED` and `REJECTED`, each then assigned to Coordinator One by the FX-ASSIGNED statement (`tests/E3/README.md`). |
| Test Steps | 1. As `lead@connectsphere.test`, reassign each to Coordinator Two through the API console (`POST /api/v1/events/<id>/reassignment`).<br>2. Read `event.assignments` for each. |
| Test Data | Statuses Confirmed, Completed, Cancelled, Rejected |
| Expected Result | The Confirmed event is reassigned to Coordinator Two. Each of the others is refused, naming its status, and keeps Coordinator One. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | CONFIRMED: 201; COMPLETED: 409 "This event is Completed and cannot be assigned."; CANCELLED: 409 "This event is Cancelled and cannot be assigned."; REJECTED: 409 "This event is Rejected and cannot be assigned.". The Confirmed event is now Coordinator Two's; the others kept Coordinator One. |
| Status | Pass |
| Remarks | Commit: 23a2d37 · Evidence: tests/E4/evidence/E4-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-27 |
