# I3-T5 — The owning organiser is notified when a replacement booking is approved (L5, M1)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T5 |
| Test Scenario | The owning organiser is notified when a replacement booking is approved (L5, M1) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. I3-T1 completed: the event returned to Planning by a block over its `Lee Kong Chian Auditorium` booking. |
| Test Steps | 1. As the coordinator, raise a replacement for the booking: the L5 replacement statement (`tests/L5/README.md`), a request for `Seminar Room 2-1`, Classroom, 2 December 2026 14:00–18:00, linked to the booking.<br>2. Sign in as `venuestaff@connectsphere.test`, open Booking requests and approve it (M1).<br>3. Sign in as `organiser@connectsphere.test` and open Notifications. |
| Test Data | Replacement at `Seminar Room 2-1` |
| Expected Result | The organiser has a notification that the replacement request was approved and the booking is confirmed (M1), and none from when the block was recorded. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

> The replacement is at `Seminar Room 2-1` because no seeded account looks after `Mochtar Riady Hall` (FX-VENUE), as in L5. Attendees are notified with the organiser (W9-51), but registration (R2) isn't built, so this case checks the organiser only.

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the block the organiser had no new notification; once BKR-004488 was approved they had one: "Booking request BKR-004488 was approved, and the booking is confirmed: Seminar Room 2-1 for EVT-013877 “Annual Research Symposium”, Wednesday 2 December 2026, 14:00–18:00.10/24/2026, 10:37:39 AMUnreadOpenMark as read". |
| Status | Pass |
| Remarks | Commit: d54760c · Evidence: tests/I3/evidence/I3-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
