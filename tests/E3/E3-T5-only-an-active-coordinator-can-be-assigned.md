# E3-T5 — Assigning anyone but an active Event Coordinator is refused and stores nothing (partition: Venue Staff, deactivated user, unknown id)

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T5 |
| Test Scenario | Assigning anyone but an active Event Coordinator is refused and stores nothing (partition: Venue Staff, deactivated user, unknown id) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed. Note its id. |
| Test Steps | 1. As `lead@connectsphere.test`, send `POST /api/v1/events/<id>/assignment` with `coordinatorId` set to `venuestaff@connectsphere.test`'s id, through the API console.<br>2. Repeat with `deactivated@connectsphere.test`'s id, and with `00000000-0000-0000-0000-0000000000ff`.<br>3. Open the Lead's assignment page for the request and read its coordinator choices.<br>4. Read `event.assignments` for the request. |
| Test Data | Venue Staff `00000000-0000-0000-0000-000000000003`, deactivated `…0006`, unknown `…00ff` |
| Expected Result | Each request is refused, saying only an active Event Coordinator can be assigned. The page offers only Coordinator One and Coordinator Two. No assignment row exists, and the request is still in the unassigned queue. |
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
