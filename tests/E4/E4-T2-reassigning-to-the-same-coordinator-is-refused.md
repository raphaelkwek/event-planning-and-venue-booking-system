# E4-T2 — Reassigning to the coordinator already assigned is refused and creates no history entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T2 |
| Test Scenario | Reassigning to the coordinator already assigned is refused and creates no history entry |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-UNDER-REVIEW completed: the request assigned to Coordinator One. |
| Test Steps | 1. As `lead@connectsphere.test`, send `POST /api/v1/events/<id>/reassignment` with Coordinator One's id, through the API console.<br>2. Read `event.assignments` for the request. |
| Test Data | Coordinator One `00000000-0000-0000-0000-000000000002` |
| Expected Result | The request is refused, saying the event is already assigned to Coordinator One. There is still one row, active, unchanged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused, 409 ALREADY_ASSIGNED: "This event is already assigned to Coordinator One.". One row, still active. The page doesn't offer Coordinator One: . |
| Status | Pass |
| Remarks | Commit: 23a2d37 · Evidence: tests/E4/evidence/E4-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-27 |
