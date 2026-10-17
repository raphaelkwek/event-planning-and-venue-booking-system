# M2-T5 — The requesting coordinator and the owning organiser are notified of the rejection, with the reason and any suggested alternative

## Specification

| Item | Content |
|---|---|
| Test Case ID | M2-T5 |
| Test Scenario | The requesting coordinator and the owning organiser are notified of the rejection, with the reason and any suggested alternative |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium` has been rejected with M2-T3's reason and suggestion. Note its booking reference. |
| Test Steps | 1. Sign in as the assigned coordinator and open "Notifications".<br>2. Sign out, sign in as `organiser@connectsphere.test`, and open "Notifications". |
| Test Data | Accounts: the assigned coordinator; `organiser@connectsphere.test` |
| Expected Result | Each has an unread notification saying the booking request was rejected, naming the booking reference, `Lee Kong Chian Auditorium` and the event's reference, and giving the reason and the suggested alternative. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Each had one unread notification. coordinator@connectsphere.test: "Booking request BKR-000401 for Lee Kong Chian Auditorium was rejected: EVT-007955 “Annual Research Symposium”, Wednesday 2 December 2026, 14:00–18:00. Reason: Already promised to another faculty. Suggested alternative: Thursday 3 December at the same time, or Seminar Room 2-110/18/2026, 1:30:03 AMUnreadOpenMark as read"; organiser@connectsphere.test: "Booking request BKR-000401 for Lee Kong Chian Auditorium was rejected: EVT-007955 “Annual Research Symposium”, Wednesday 2 December 2026, 14:00–18:00. Reason: Already promised to another faculty. Suggested alternative: Thursday 3 December at the same time, or Seminar Room 2-110/18/2026, 1:30:03 AMUnreadOpenMark as read". |
| Status | Pass |
| Remarks | Commit: 9adf0ff · Evidence: tests/M2/evidence/M2-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
