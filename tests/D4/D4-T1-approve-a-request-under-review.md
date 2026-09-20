# D4-T1 — Approve a request under review

## Specification

| Item | Content |
|---|---|
| Test Case ID | D4-T1 |
| Test Scenario | Approve a request under review |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Approve". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | "This request is Approved" appears, reading "Decided", the date and time, and "by Coordinator One". The status shows "Approved", and "Approve" and "Reject" are both disabled. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "This request is ApprovedDecided 9/20/2026, 3:29:03 PM by Coordinator One.A request that already carries a decision cannot be decided again." was shown, the status became "Approved", and both Approve and Reject are disabled. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D4/evidence/D4-T1.png · Defect: — |
| Executed By | Raphael Kwek |
| Date of Execution | 2026-09-20 |
