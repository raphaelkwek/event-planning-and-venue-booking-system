# T2-T8 — Only the related organiser is notified; another organiser receives nothing about the event

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T8 |
| Test Scenario | Only the related organiser is notified; another organiser receives nothing about the event |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed (the request belongs to `organiser@connectsphere.test`). |
| Test Steps | 1. Sign in as `organiser2@connectsphere.test`.<br>2. Click "Notifications". |
| Test Data | Account: `organiser2@connectsphere.test` |
| Expected Result | No notification about the request is listed, and the unread count is 0. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | organiser2's list had 0 notification(s), none about EVT-004527; the navigation read "Notifications" with no count. |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
