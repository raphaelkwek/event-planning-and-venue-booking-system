# C1-T5 — Saving with an event name of spaces only is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | C1-T5 |
| Test Scenario | Saving with an event name of spaces only is refused |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the Event name.<br>3. Click "Save draft".<br>4. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Event name: three spaces |
| Expected Result | Step 3 is refused with `VALIDATION_FAILED`, and "Event name is required." appears under Event name, because a name of spaces is not a name. Step 4 shows no new row. |
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
