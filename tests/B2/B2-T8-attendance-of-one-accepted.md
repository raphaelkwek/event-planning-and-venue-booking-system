# B2-T8 — Expected attendance of 1 is accepted (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T8 |
| Test Scenario | Expected attendance of 1 is accepted (boundary: exactly at) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, with the change in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Expected attendance: `1` |
| Expected Result | The request page opens with status "Submitted" and a reference of the form `EVT-` followed by six digits. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Accepted: status "Submitted", reference EVT-001714, and the page shows expected attendance 1. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/B2/evidence/B2-T8.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
