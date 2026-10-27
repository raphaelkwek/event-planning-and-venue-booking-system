# E3-T6 — A request that already has a coordinator cannot be assigned a second: there is never more than one active assignment

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T6 |
| Test Scenario | A request that already has a coordinator cannot be assigned a second: there is never more than one active assignment |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. E3-T4 completed: the request assigned to Coordinator Two. |
| Test Steps | 1. As `lead@connectsphere.test`, send `POST /api/v1/events/<id>/assignment` with `coordinator@connectsphere.test`'s id.<br>2. Read `event.assignments` for the request. |
| Test Data | Coordinator One |
| Expected Result | The request is refused: the event is already assigned to Coordinator Two, and a Lead reassigns it instead (E4). There is still one row, Coordinator Two's, active. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The second assignment was refused, 409 ALREADY_ASSIGNED: "This event is already assigned to Coordinator Two. Reassign it instead.". One row, Coordinator Two's, is active; the page offers no Assign. |
| Status | Pass |
| Remarks | Commit: f17c393 · Evidence: tests/E3/evidence/E3-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-27 |
