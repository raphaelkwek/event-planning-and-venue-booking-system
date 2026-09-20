# B2-T7 — Expected attendance of 0 is refused (boundary: just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T7 |
| Test Scenario | Expected attendance of 0 is refused (boundary: just below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, with the change in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Expected attendance: `0` |
| Expected Result | Submission is refused with `VALIDATION_FAILED` "This request is not ready to be submitted.", and "Expected attendance must be a whole number greater than zero." appears under the Expected attendance field. "My requests" shows no new submitted row. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with "Expected attendance must be a whole number greater than zero." under Expected attendance. No submitted row was created. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/B2/evidence/B2-T7.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
