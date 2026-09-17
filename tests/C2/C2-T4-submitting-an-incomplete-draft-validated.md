# C2-T4 — Submitting an incomplete draft applies the full submission validation

## Specification

| Item | Content |
|---|---|
| Test Case ID | C2-T4 |
| Test Scenario | Submitting an incomplete draft applies the full submission validation |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-DRAFT with Event name `Only a name` completed.<br>3. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "My requests", then "Open draft" on "Only a name".<br>2. Click "Submit request".<br>3. Click "My requests". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | Step 2 is refused with `VALIDATION_FAILED`, naming Purpose, Description, Proposed start, Proposed end and Expected attendance at once. Step 3 still shows "Only a name" as a Draft with no reference. |
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
