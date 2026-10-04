# T2-T15 — Opening a notification goes to the related event

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T15 |
| Test Scenario | Opening a notification goes to the related event |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed; note the reference. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. Click "Notifications", then "Open" on the approval notification. |
| Test Data | — |
| Expected Result | The request's own page opens, showing its reference and status Approved. The notification is now read. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | "Open" went to #/requests/fe95a978-58bd-45a2-9db5-98c8b38a1da6, showing EVT-004534 with status Approved; the notification was then read. |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T15.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
