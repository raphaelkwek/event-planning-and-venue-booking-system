# E4-T6 — Coordinator-to-coordinator reassignment (E2) is retired: a coordinator is offered no proposal and the API refuses one

## Specification

| Item | Content |
|---|---|
| Test Case ID | E4-T6 |
| Test Scenario | Coordinator-to-coordinator reassignment (E2) is retired: a coordinator is offered no proposal and the API refuses one |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-UNDER-REVIEW completed: the request assigned to Coordinator One. |
| Test Steps | 1. Sign in as `coordinator@connectsphere.test`, open the request and look for "Propose reassignment".<br>2. Through the API console, send `POST /api/v1/events/<id>/reassignment-proposals` with Coordinator Two's id.<br>3. Run `select count(*) from event.reassignment_proposals where event_id = '<id>';`. |
| Test Data | Nominee Coordinator Two |
| Expected Result | No "Propose reassignment" is offered. The API refuses the proposal, saying the Event Coordinator Lead reassigns events. The count is 0. |
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
