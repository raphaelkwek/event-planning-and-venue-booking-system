# B2-T5 — End time earlier than the start is refused (boundary: below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T5 |
| Test Scenario | End time earlier than the start is refused (boundary: below) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, with the change in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Proposed end: 2 December 2026, 10:00 |
| Expected Result | Submission is refused with `VALIDATION_FAILED` "This request is not ready to be submitted.", and "The end date and time must be later than the start date and time." appears under the Proposed end field. "My requests" shows no new submitted row. |
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
