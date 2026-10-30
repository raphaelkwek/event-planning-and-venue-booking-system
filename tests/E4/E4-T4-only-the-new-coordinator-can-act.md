# E4-T4 — From the reassignment, only the new coordinator can perform coordinator actions on the event; the previous coordinator no longer can

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T4 |
| Test Scenario | From the reassignment, only the new coordinator can perform coordinator actions on the event; the previous coordinator no longer can |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed: the request assigned to Coordinator One and approved (G1 edits an Approved event).<br>3. Reassigned to Coordinator Two by `lead@connectsphere.test`, as in E4-T1. |
| Test Steps | 1. Sign in as `coordinator@connectsphere.test`, open the request and look for "Edit details" (G1); then send `PATCH /api/v1/events/<id>` through the API console with a new purpose.<br>2. Sign in as `coordinator2@connectsphere.test`, open the request, click "Edit details", change the purpose and save. |
| Test Data | Purpose `Share faculty research across schools` |
| Expected Result | Coordinator One is offered no "Edit details", and the API refuses the edit, naming that they are not the assigned coordinator; nothing changes. Coordinator Two's edit is saved. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Coordinator One was offered no "Edit details", and the API refused the edit, 403 ROLE_NOT_AUTHORISED: "Only the owning organiser or the assigned coordinator can edit this event's details.". Coordinator Two's edit was saved. |
| Status | Pass |
| Remarks | Commit: 23a2d37 · Evidence: tests/E4/evidence/E4-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-27 |
