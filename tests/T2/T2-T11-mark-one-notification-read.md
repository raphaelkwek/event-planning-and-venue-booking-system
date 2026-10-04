# T2-T11 — A notification can be marked read on its own

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T11 |
| Test Scenario | A notification can be marked read on its own |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. T2-T10's pre-conditions completed. Signed in as `organiser@connectsphere.test`, on "Notifications". |
| Test Steps | 1. Click "Mark as read" on the approval notification. |
| Test Data | — |
| Expected Result | The approval notification is no longer marked unread; the clarification request still is. The navigation reads "Notifications (1)". |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The approval was no longer marked unread, the clarification request still was, and the navigation read "Notifications (1)". |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T11.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
