# G1-T12 — Saving without changing anything stores nothing and writes no history

## Specification

| Item | Content |
|---|---|
| Test Case ID | G1-T12 |
| Test Scenario | Saving without changing anything stores nothing and writes no history |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed. Note its id.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Open the request, click "Edit details", and click "Save details" without changing anything.<br>2. In the SQL editor, count the event's field-change history. |
| Test Data | Account: `organiser@connectsphere.test` |
| Expected Result | "No changes to save." is shown, and there is no field-change history. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-11 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
