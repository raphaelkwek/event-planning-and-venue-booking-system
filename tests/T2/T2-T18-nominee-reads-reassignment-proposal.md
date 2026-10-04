# T2-T18 — The nominated coordinator reads a notification of a reassignment proposal (E2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T18 |
| Test Scenario | The nominated coordinator reads a notification of a reassignment proposal (E2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed. |
| Test Steps | 1. Sign in as the nominee.<br>2. Click "Notifications". |
| Test Data | The nominee from FX-REASSIGNMENT-PENDING |
| Expected Result | A notification names the request and says the nominee has been nominated to take over as coordinator, and can accept or decline. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | coordinator2's list showed: "You have been nominated to take over as coordinator of EVT-004537 “Annual Research Symposium”. Accept or decline the proposal. 10/4/2026, 4:41:50 PM UNREAD Open Mark as read". |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T18.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
