# E3-T1 — A newly submitted request is assigned to no coordinator: it enters the unassigned queue, and the organiser sees it awaiting assignment

## Specification

| Item | Content |
|---|---|
| Test Case ID | E3-T1 |
| Test Scenario | A newly submitted request is assigned to no coordinator: it enters the unassigned queue, and the organiser sees it awaiting assignment |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Submit the standard request (FX-SUBMITTED). Note its reference.<br>2. Open it from "My requests" and read the assigned coordinator.<br>3. Sign in as `lead@connectsphere.test` and open "Unassigned".<br>4. In the SQL editor, run `select count(*) from event.assignments where event_id = '<id>';`. |
| Test Data | The standard request |
| Expected Result | The organiser sees the request "Awaiting assignment", with no coordinator named. The Lead's unassigned queue lists it. The query returns 0, and no coordinator has a notification about it. |
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
