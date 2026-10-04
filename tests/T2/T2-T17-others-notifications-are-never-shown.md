# T2-T17 — Notifications belonging to other users are never shown

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T17 |
| Test Scenario | Notifications belonging to other users are never shown |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed.<br>3. In the SQL editor, note the id of the organiser's approval notification: `select id from notification.notifications where recipient_user_id = '00000000-0000-0000-0000-000000000001';` |
| Test Steps | 1. Sign in as `organiser2@connectsphere.test`; click "Notifications".<br>2. Open "API console" and send `POST /notification/api/v1/notifications/<notification id>/read`. |
| Test Data | Account: `organiser2@connectsphere.test` |
| Expected Result | Step 1 lists none of the first organiser's notifications. Step 2 is refused with `404` and code `NOTIFICATION_NOT_FOUND`, and the first organiser's notification stays unread. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | organiser2's list showed none of the first organiser's notifications; marking theirs read returned 404 NOTIFICATION_NOT_FOUND, and it stayed unread. |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T17.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
