# M1-T8 — The requesting coordinator and the owning organiser are notified of the approval

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T8 |
| Test Scenario | The requesting coordinator and the owning organiser are notified of the approval |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed. Note the event's reference.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00 has been approved. Note its booking reference. |
| Test Steps | 1. Sign in as the assigned coordinator and open "Notifications".<br>2. Sign out, sign in as `organiser@connectsphere.test`, and open "Notifications". |
| Test Data | Accounts: the assigned coordinator; `organiser@connectsphere.test` · Notifications arrive about a second after the approval |
| Expected Result | Each has an unread notification saying the booking request was approved and the booking is confirmed, naming the booking reference, `Lee Kong Chian Auditorium`, the event's reference and Wednesday 2 December 2026 14:00–18:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Each had one unread notification. coordinator@connectsphere.test: "Booking request BKR-000391 was approved, and the booking is confirmed: Lee Kong Chian Auditorium for EVT-007947 “Annual Research Symposium”, Wednesday 2 December 2026, 14:00–18:00.10/18/2026, 1:29:31 AMUnreadOpenMark as read"; organiser@connectsphere.test: "Booking request BKR-000391 was approved, and the booking is confirmed: Lee Kong Chian Auditorium for EVT-007947 “Annual Research Symposium”, Wednesday 2 December 2026, 14:00–18:00.10/18/2026, 1:29:31 AMUnreadOpenMark as read". |
| Status | Pass |
| Remarks | Commit: 9adf0ff · Evidence: tests/M1/evidence/M1-T8.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
