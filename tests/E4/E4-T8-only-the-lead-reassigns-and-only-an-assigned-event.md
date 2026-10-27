# E4-T8 — Only the Lead can reassign, and only an event that has a coordinator: anyone else is refused, an unassigned event is assigned instead (E3), and an inactive coordinator can't be chosen

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T8 |
| Test Scenario | Only the Lead can reassign, and only an event that has a coordinator: anyone else is refused, an unassigned event is assigned instead (E3), and an inactive coordinator can't be chosen |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-UNDER-REVIEW completed, and a second request FX-SUBMITTED (unassigned). |
| Test Steps | 1. Through the API console, send `POST /api/v1/events/<id>/reassignment` with Coordinator Two's id as `coordinator@connectsphere.test`, then as `organiser@connectsphere.test`.<br>2. As `lead@connectsphere.test`, send it for the unassigned request.<br>3. As `lead@connectsphere.test`, send it for the first request with `venuestaff@connectsphere.test`'s id. |
| Test Data | Coordinator Two; Venue Staff `00000000-0000-0000-0000-000000000003` |
| Expected Result | The coordinator and the organiser are refused as not authorised. The unassigned request is refused, saying it has no coordinator to replace and should be assigned. Venue Staff is refused: only an active Event Coordinator can be assigned. Nothing changes. |
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
