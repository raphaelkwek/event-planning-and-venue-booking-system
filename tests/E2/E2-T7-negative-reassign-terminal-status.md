# E2-T7 — Reassignment is refused once the event is Rejected

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T7 |
| Test Scenario | Reassignment proposals are permitted only for events not in status Completed, Cancelled, or Rejected |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REJECTED completed. |
| Test Steps | 1. Sign in as the coordinator shown in "Assigned coordinator".<br>2. Open the rejected request.<br>3. Confirm whether "Propose reassignment" is offered; if it is, attempt to use it. |
| Test Data | — |
| Expected Result | "Propose reassignment" is not shown once the request is Rejected. If attempted directly via the API console, `POST /event/api/v1/events/<id>/reassignment-proposals` returns `409 REASSIGNMENT_NOT_PERMITTED` naming the event's current status. No row is created in `event.reassignment_proposals`. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
