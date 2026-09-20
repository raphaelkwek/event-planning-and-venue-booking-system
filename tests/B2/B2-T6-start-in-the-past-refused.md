# B2-T6 — A proposed start in the past is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T6 |
| Test Scenario | A proposed start in the past is refused |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, with the changes in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Proposed start: 1 September 2026, 14:00 · Proposed end: 1 September 2026, 18:00 |
| Expected Result | Submission is refused with `VALIDATION_FAILED` "This request is not ready to be submitted.", and "The proposed start date and time must not be in the past." appears under the Proposed start field. "My requests" shows no new submitted row. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Submission was refused with VALIDATION_FAILED; the field showed “The proposed start date and time must not be in the past.”; no event row was created. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B2/evidence/B2-T6-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |