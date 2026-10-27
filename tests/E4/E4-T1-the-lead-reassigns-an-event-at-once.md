# E4-T1 — The Lead reassigns an event to another active Event Coordinator: it takes effect at once, the outgoing assignment is closed and kept, and the new one records the coordinator, the Lead and the time

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T1 |
| Test Scenario | The Lead reassigns an event to another active Event Coordinator: it takes effect at once, the outgoing assignment is closed and kept, and the new one records the coordinator, the Lead and the time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed: the request assigned to Coordinator One, who has opened it.<br>3. Signed in as `lead@connectsphere.test`. |
| Test Steps | 1. Open `#/assignments/<id>` (the request's assignment page, E3), choose `Coordinator Two` under "Reassign" and click "Reassign".<br>2. In the SQL editor, run `select coordinator_id, created_by, assigned_at, ended_at, is_active from event.assignments where event_id = '<id>' order by assigned_at;`. |
| Test Data | From Coordinator One to Coordinator Two |
| Expected Result | The page says the event is reassigned to Coordinator Two, with no acceptance step. Two rows: Coordinator One's, inactive, with an end time; and Coordinator Two's, active, made by the Lead, starting at that time. |
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
