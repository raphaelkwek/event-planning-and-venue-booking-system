# B2-T9 — A fractional expected attendance is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T9 |
| Test Scenario | A fractional expected attendance is refused |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, with the change in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Expected attendance: `12.5` |
| Expected Result | Submission is refused with `VALIDATION_FAILED` "This request is not ready to be submitted.", and "Expected attendance must be a whole number greater than zero." appears under the Expected attendance field. "My requests" shows no new submitted row. |
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
