# D5-T1 — Reject a request under review, giving a reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T1 |
| Test Scenario | Reject a request under review, giving a reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed. The coordinator is on the review screen. |
| Test Steps | 1. Click "Reject".<br>2. Enter the reason in the dialog.<br>3. Click "Reject request". |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Reason: `No venue can host 150 people on 2 December.` |
| Expected Result | The dialog closes. The status shows "Rejected". The page shows the reason "No venue can host 150 people on 2 December." and the decision date and time. "Approve" and "Reject" are both disabled. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog closed, the status became "Rejected", the reason "No venue can host 150 people on 2 December." and the decision time 9/20/2026, 3:29:25 PM are shown, and both Approve and Reject are disabled. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D5/evidence/D5-T1.png · Defect: — |
| Executed By | Raphael Kwek |
| Date of Execution | 2026-09-20 |
