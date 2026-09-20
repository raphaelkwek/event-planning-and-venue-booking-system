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
| Created By | Raphael Kwek |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with VALIDATION_FAILED and "Event name is required." under Event name — a name of spaces is not a name. No row was listed or stored. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/C1/evidence/C1-T5.png · Defect: — |
| Executed By | Shawmya |
| Date of Execution | 2026-09-20 |
