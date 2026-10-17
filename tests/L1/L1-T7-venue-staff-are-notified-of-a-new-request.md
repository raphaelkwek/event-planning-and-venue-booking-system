# L1-T7 — A new request notifies the venue's Venue Staff

## Specification

| Item | Content |
|---|---|
| Test Case ID | L1-T7 |
| Test Scenario | A new request notifies the venue's Venue Staff |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed. Note the event's reference.<br>3. The assigned coordinator has submitted a request for `Lee Kong Chian Auditorium` with the event's times. Note its booking reference. |
| Test Steps | 1. Sign in as `venuestaff@connectsphere.test`.<br>2. Click "Notifications". |
| Test Data | Account: `venuestaff@connectsphere.test` · Notifications arrive about a second after the request (they travel through Kafka) |
| Expected Result | An unread notification says a booking request has been submitted for `Lee Kong Chian Auditorium`, naming the booking reference, the event's reference and 2 December 2026 14:00–18:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | An unread notification read: "Booking request BKR-000415 was submitted for Lee Kong Chian Auditorium: EVT-007964 “Annual Research Symposium”, Wednesday 2 December 2026, 14:00–18:00. It is waiting in your Booking requests queue.10/18/2026, 1:31:21 AMUnreadOpenMark as read". |
| Status | Pass |
| Remarks | Commit: ff9e786 · Evidence: tests/L1/evidence/L1-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
