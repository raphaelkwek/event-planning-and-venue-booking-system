# I2-T8 — CR-02: the assigned coordinator of each disrupted event is notified, naming the venue, booking reference, event reference, blocked period and reason, and that alternative arrangements are required

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T8 |
| Test Scenario | CR-02: the assigned coordinator of each disrupted event is notified, naming the venue, booking reference, event reference, blocked period and reason, and that alternative arrangements are required |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed. Note the event's reference.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium` 14:00–18:00 has been approved; note its booking reference. I2-T6's block recorded over it. |
| Test Steps | 1. Sign in as the assigned coordinator and open "Notifications". |
| Test Data | Account: the assigned coordinator · Notifications arrive about a second after the block |
| Expected Result | An unread notification names `Lee Kong Chian Auditorium`, the booking reference, the event's reference, Wednesday 2 December 2026, 16:00–19:00, Maintenance and `Stage rigging inspection`, and says alternative arrangements are required. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
