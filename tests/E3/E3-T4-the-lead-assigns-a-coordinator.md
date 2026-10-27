# E3-T4 — The Lead assigns an active Event Coordinator: the assignment records the coordinator, the Lead and the time, the request leaves the queue, and the coordinator and organiser are notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T4 |
| Test Scenario | The Lead assigns an active Event Coordinator: the assignment records the coordinator, the Lead and the time, the request leaves the queue, and the coordinator and organiser are notified |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed.<br>3. Signed in as `lead@connectsphere.test`. |
| Test Steps | 1. Open the request from "Unassigned", choose `Coordinator Two` and click "Assign".<br>2. Reopen "Unassigned".<br>3. In the SQL editor, run `select coordinator_id, created_by, assigned_at, is_active from event.assignments where event_id = '<id>';`.<br>4. Sign in as `coordinator2@connectsphere.test`; open Notifications, then the review queue.<br>5. Sign in as `organiser@connectsphere.test`; open Notifications, then the request. |
| Test Data | Coordinator: `coordinator2@connectsphere.test` |
| Expected Result | The page says the request is assigned to Coordinator Two, and it is no longer in the queue. One active row: Coordinator Two's id, the Lead's id, and the time of assigning. Coordinator Two has a notification that the request is assigned to them, and it is in their review queue. The organiser has a notification naming Coordinator Two, and the request shows Coordinator Two as the point of contact. |
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
