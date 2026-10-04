# T2-T10 — The list shows my own notifications, newest first, with an unread count

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T10 |
| Test Scenario | The list shows my own notifications, newest first, with an unread count |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-AWAITING completed (the organiser is asked for clarification); then, as the organiser, respond to it with `150 is correct.`, and, as the coordinator, approve the request. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. Look at "Notifications" in the navigation.<br>3. Click "Notifications". |
| Test Data | Account: `organiser@connectsphere.test` |
| Expected Result | The navigation reads "Notifications (2)". The list shows two unread notifications, newest first: the approval above the clarification request. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The navigation read "Notifications (2)". The list showed two unread notifications, the approval first and the clarification request second. |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T10.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
