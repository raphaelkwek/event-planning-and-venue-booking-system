# N1-T7 — Bookings and requests that were withdrawn, rejected, cancelled or released never block a new booking for the same period

## Specification

| Item | Content |
|---|---|
| Test Case ID | N1-T7 |
| Test Scenario | Bookings and requests that were withdrawn, rejected, cancelled or released never block a new booking for the same period |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 14:00, end 18:00, setup 0 and turnaround 0, then the N1 release statement run for it; then both again. One stands for a cancelled event's booking, one for a released booking (F4 and L5 both release a booking). Each is released before the next is made, because two confirmed bookings for the same period can't exist at once.<br>4. The N1 second event statement run; its coordinator has requested `Lee Kong Chian Auditorium` for 14:00–18:00 twice over: one request withdrawn, and one set `REJECTED` with the L2 decision statement.<br>5. The first event's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 14:00–18:00.<br>6. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests", then "Approve" on the first event's request and "Approve request". |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The approval goes through: none of the released bookings or the withdrawn or rejected requests blocks it. The venue has exactly one confirmed booking that day, the new one. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With two released bookings, a withdrawn request (BKR-000523) and a rejected one (BKR-000524) for 14:00–18:00, the approval of BKR-000525 went through. The venue has exactly one confirmed booking that day, the new one. |
| Status | Pass |
| Remarks | Commit: 7c418d5 · Evidence: tests/N1/evidence/N1-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
