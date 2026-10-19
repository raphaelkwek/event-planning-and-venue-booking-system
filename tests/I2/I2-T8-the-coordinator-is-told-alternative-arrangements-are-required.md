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
| Actual Result | An unread notification read: "Lee Kong Chian Auditorium is unavailable on Wednesday 2 December 2026, 16:00–19:00 (Maintenance: Stage rigging inspection), which disrupts booking BKR-001117 for EVT-009050 “Annual Research Symposium”. The booking requires reconfirmation, and alternative arrangements are required.10/19/2026, 4:18:12 PMUnreadOpenMark as read". |
| Status | Pass |
| Remarks | Commit: a9a9cc4 · Evidence: tests/I2/evidence/I2-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
