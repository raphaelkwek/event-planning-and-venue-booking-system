# B2-T14 — "No equipment required" is accepted as a complete equipment answer

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T14 |
| Test Scenario | "No equipment required" is accepted as a complete equipment answer |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, leaving "Equipment is required" unticked.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Equipment is required: unticked |
| Expected Result | The request page opens with status "Submitted" and a reference of the form `EVT-` followed by six digits. On the request page, "Equipment required" shows "No". |
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
