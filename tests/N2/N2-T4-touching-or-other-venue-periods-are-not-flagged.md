# N2-T4 — Periods that only touch, and overlapping periods at different venues, are not flagged

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T4 |
| Test Scenario | Periods that only touch, and overlapping periods at different venues, are not flagged |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed, with setup and turnaround 0 at every venue.<br>3. The N1 booking statement run with start 10:00, end 14:00, setup 0 and turnaround 0.<br>4. FX-BOOKING's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00, and `Seminar Room 2-1`, Classroom, 40 attendees, 2 December 2026 14:00–18:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Read both requests' rows. |
| Test Data | Booking 10:00–14:00 · Both requests 14:00–18:00 |
| Expected Result | Neither row shows "Conflict": the request at `Lee Kong Chian Auditorium` only touches the booking at 14:00, and the two requests are for different venues. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Neither row showed a conflict: "BKR-002985EVT-012025Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:48:42 AMApprove Reject" / "BKR-002986EVT-012025Seminar Room 2-1Wednesday 2 December 2026, 14:00–18:00Classroom40 attending——SuitableCoordinator One10/21/2026, 12:48:42 AMDiffers from the eventAttendance 40 (event 150)Approve Reject". |
| Status | Pass |
| Remarks | Commit: f0c7c9d · Evidence: tests/N2/evidence/N2-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
