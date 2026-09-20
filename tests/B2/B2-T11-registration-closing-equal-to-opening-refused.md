# B2-T11 — A registration closing equal to its opening is refused (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T11 |
| Test Scenario | A registration closing equal to its opening is refused (boundary: exactly at) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, tick "Attendee registration is required", and enter the window in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Registration opens: 20 November 2026, 09:00 · Registration closes: 20 November 2026, 09:00 |
| Expected Result | Submission is refused with `VALIDATION_FAILED` "This request is not ready to be submitted.", and "Registration closing must be later than registration opening." appears under the Registration closes field. "My requests" shows no new submitted row. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | VALIDATION_FAILED showed “Registration closing must be later than registration opening.”; no event row was created. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B2/evidence/B2-T11-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |