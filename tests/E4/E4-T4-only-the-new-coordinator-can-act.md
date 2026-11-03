# E4-T4 — From the reassignment, only the new coordinator can perform coordinator actions on the event; the previous coordinator no longer can

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T4 |
| Test Scenario | From the reassignment, only the new coordinator can perform coordinator actions on the event; the previous coordinator no longer can |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed: the request assigned to Coordinator One and approved (G1 edits an Approved event).<br>3. Reassigned to Coordinator Two by `lead@connectsphere.test`, as in E4-T1. |
| Test Steps | 1. Sign in as `coordinator@connectsphere.test`, look for the request in "All events", then go to `#/review/<id>`; then send `PATCH /event/api/v1/events/<id>` through the API console with a new purpose.<br>2. Sign in as `coordinator2@connectsphere.test`, open the request, click "Edit details", change the purpose and save. |
| Test Data | Purpose `Share faculty research across schools` |
| Expected Result | Coordinator One no longer has the request in "All events", the page shows "No event with that reference is assigned to you.", and the API refuses the edit with `404` `EVENT_NOT_FOUND` and the same message; nothing changes. Coordinator Two's edit is saved. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-27 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** From the reassignment the previous coordinator can't open the event at all, and the API answers 404.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-02; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
