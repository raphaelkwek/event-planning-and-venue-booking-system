# D4-T4 — The owning organiser sees the approval and its date

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T4 |
| Test Scenario | The owning organiser sees the approval and its date |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `organiser@connectsphere.test`.<br>2. Click "My requests", then "View" on the request. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "This request was approved" reads "Approved" followed by the decision date and time, and Decision in the side panel shows the same date and time. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The organiser saw "This request was approvedApproved 9/20/2026, 3:29:12 PM.", and Decision in the side panel reads "9/20/2026, 3:29:12 PM" — the same date and time. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D4/evidence/D4-T4.png · Defect: — |
| Executed By | Raphael Kwek |
| Date of Execution | 2026-09-20 |
