# B2-T10 — With registration required, a missing registration window is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T10 |
| Test Scenario | With registration required, a missing registration window is refused |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, tick "Attendee registration is required", and leave both registration fields empty.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Attendee registration is required: ticked · Registration opens: *(empty)* · Registration closes: *(empty)* |
| Expected Result | Submission is refused with `VALIDATION_FAILED`. "Registration opening date and time is required when registration is required." appears under Registration opens, and "Registration closing date and time is required when registration is required." under Registration closes, both at once. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | VALIDATION_FAILED showed both missing registration-window messages simultaneously; no event row was created. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B2/evidence/B2-T10-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |