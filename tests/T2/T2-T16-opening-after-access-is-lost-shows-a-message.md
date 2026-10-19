# T2-T16 — Opening a notification about an event the user can no longer see shows a message and no event data

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T16 |
| Test Scenario | Opening a notification about an event the user can no longer see shows a message and no event data |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-APPROVED completed; note the request's id and reference.<br>3. FX-NOTIFICATION-ELSEWHERE run with that id and reference. |
| Test Steps | 1. Sign in as `organiser2@connectsphere.test`.<br>2. Click "Notifications", then "Open" on the notification. |
| Test Data | Account: `organiser2@connectsphere.test` |
| Expected Result | A message says the event is not available to you. No detail of the request (name, purpose, dates, status) is shown. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Opening it showed "EVENT_NOT_FOUND No event with that reference is available to you. HTTP 404 · correlation 9987c252-56a8-4dfa-aae0-dd24e4486a5f", with none of the request's details. |
| Status | Pass |
| Remarks | Commit: 84fc315 · Evidence: tests/T2/evidence/T2-T16.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
