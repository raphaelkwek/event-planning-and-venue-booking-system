# L4-T3 — Conflicts are checked for each venue on its own (N1, N2)

## Specification

| Item | Content |
|---|---|
| Test Case ID | L4-T3 |
| Test Scenario | Conflicts are checked for each venue on its own (N1, N2) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 13:00, end 15:00, setup 0 and turnaround 0: another event's booking at `Lee Kong Chian Auditorium` (`tests/N1/README.md`).<br>4. FX-BOOKING's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 150, and `Seminar Room 2-1`, Classroom, 40, both 14:00–18:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Read both requests' rows.<br>3. Approve the `Seminar Room 2-1` request, then try to approve the `Lee Kong Chian Auditorium` one. |
| Test Data | The other event's booking is at `Lee Kong Chian Auditorium` only |
| Expected Result | Only the `Lee Kong Chian Auditorium` request shows "Conflict", naming the other booking. The `Seminar Room 2-1` request is approved; the `Lee Kong Chian Auditorium` approval is refused, naming the other event, and that request stays Pending. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | In the queue only the Lee Kong Chian Auditorium request was flagged ("BKR-003311EVT-012340Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 1:07:03 AMConflictConflicts with N1-FX-EVT-012341 (confirmed booking), Wednesday 2 December 2026, 13:00–15:00Approve Reject"); the Seminar Room 2-1 one wasn't. Seminar Room 2-1 was approved; the Lee Kong Chian Auditorium approval was refused: "BKR-003311 wasn't approved: Lee Kong Chian Auditorium is already booked for EVT-012341 (Wednesday 2 December 2026, 13:00–15:00), counting setup and turnaround time. Nothing was approved, and the request is still Pending.", and it stayed PENDING. |
| Status | Pass |
| Remarks | Commit: 333eb08 · Evidence: tests/L4/evidence/L4-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
