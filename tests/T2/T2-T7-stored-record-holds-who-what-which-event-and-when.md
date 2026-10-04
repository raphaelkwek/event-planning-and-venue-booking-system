# T2-T7 — The stored notification records the recipient, type, event reference, creation time and a message

## Specification

| Item | Content |
|---|---|
| Test Case ID | T2-T7 |
| Test Scenario | The stored notification records the recipient, type, event reference, creation time and a message |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request's id and reference. |
| Test Steps | 1. Wait two seconds.<br>2. In the SQL editor run: `select recipient_user_id, notification_type, event_reference, created_at, message from notification.notifications where event_id = '<id>' and notification_type = 'event.approved';` |
| Test Data | The request from FX-APPROVED |
| Expected Result | One row: recipient `00000000-0000-0000-0000-000000000001` (the organiser), type `event.approved`, the request's reference, a creation timestamp, and a message naming the reference and the event and saying it has been approved. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
