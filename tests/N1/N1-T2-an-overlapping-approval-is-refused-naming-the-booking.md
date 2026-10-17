# N1-T2 — Approving a request that overlaps another event's confirmed booking is refused, naming that event and its period, and the request stays Pending

## Specification

| Item | Content |
|---|---|
| Test Case ID | N1-T2 |
| Test Scenario | Approving a request that overlaps another event's confirmed booking is refused, naming that event and its period, and the request stays Pending |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 13:00, end 15:00, setup 0 and turnaround 0 (`tests/N1/README.md`). Note the returned event reference.<br>4. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Click "Approve" on the request, then "Approve request".<br>3. In the SQL editor, read the request's status and count the confirmed bookings for its event. |
| Test Data | Account: `venuestaff@connectsphere.test` · The other event's booking is 13:00–15:00 |
| Expected Result | The approval is refused with a message naming the other event's reference and its period, Wednesday 2 December 2026 13:00–15:00, and saying nothing was approved. The request is still listed in the queue, and is `PENDING` in the database; its event has no confirmed booking. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The approval was refused: "BKR-000516 wasn't approved: Lee Kong Chian Auditorium is already booked for EVT-008063 (Wednesday 2 December 2026, 13:00–15:00), counting setup and turnaround time. Nothing was approved, and the request is still Pending." The request is still in the queue and PENDING; its event has no confirmed booking. |
| Status | Pass |
| Remarks | Commit: 7c418d5 · Evidence: tests/N1/evidence/N1-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-18 |
