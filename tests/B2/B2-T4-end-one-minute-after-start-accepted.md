# B2-T4 — End time one minute after the start is accepted (boundary: just above)

## Specification

| Item | Content |
|---|---|
| Test Case ID | B2-T4 |
| Test Scenario | End time one minute after the start is accepted (boundary: just above) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test`. |
| Test Steps | 1. Click "New request".<br>2. Enter the standard request, with the change in Test Data.<br>3. Click "Submit request". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Proposed end: 2 December 2026, 14:01 |
| Expected Result | The request page opens with status "Submitted" and a reference of the form `EVT-` followed by six digits. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | End one minute after start was accepted as Submitted with EVT-001885. |
| Status | Pass |
| Remarks | Commit: b0ef6ee · Evidence: tests/B2/evidence/B2-T4-2026-09-20.png · Defect: — |
| Executed By | Joash Lau Rong Wei |
| Date of Execution | 2026-09-20 |