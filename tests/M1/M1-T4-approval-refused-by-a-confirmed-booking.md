# M1-T4 — Approval is refused when the period now overlaps a confirmed booking; the message names it, no booking is created, and the request stays Pending

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T4 |
| Test Scenario | Approval is refused when the period now overlaps a confirmed booking; the message names it, no booking is created, and the request stays Pending |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The M1 booking statement run with start 13:00, end 15:00, setup 0 and turnaround 0 (`tests/M1/README.md`). Note the returned event reference.<br>4. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests", then "Approve" on the request, then "Approve request".<br>2. In the SQL editor, read the request's status and count its confirmed bookings. |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | The dialog shows a refusal naming the other event's reference and its period, Wednesday 2 December 2026 13:00–15:00, and saying nothing was approved. The request is still in the queue and `PENDING`, with no booking. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The dialog showed "BKR-001149 wasn't approved: Lee Kong Chian Auditorium is already booked for EVT-009136 (Wednesday 2 December 2026, 13:00–15:00), counting setup and turnaround time. Nothing was approved, and the request is still Pending." The request is still in the queue and PENDING, with no booking. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/M1/evidence/M1-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
