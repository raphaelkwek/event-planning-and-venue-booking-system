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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
