# N2-T7 — Withdrawing or rejecting the other request clears the flag

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T7 |
| Test Scenario | Withdrawing or rejecting the other request clears the flag |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. N2-T1's pre-conditions 2 to 5 completed, plus a third request by FX-BOOKING's coordinator for `Lee Kong Chian Auditorium`, Theatre, 19:00–21:00 (request C), which overlaps only B. |
| Test Steps | 1. As the other coordinator, withdraw request B (L2).<br>2. As `venuestaff@`, open "Booking requests" and read requests A's and C's rows.<br>3. Reset, repeat the pre-conditions, and as `venuestaff@` reject request B with the reason "Double-booked" (M2). Read A's and C's rows. |
| Test Data | Request C 19:00–21:00 |
| Expected Result | After B is withdrawn, and again after it is rejected, neither A nor C shows "Conflict". Both stay Pending. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | after B was withdrawn, A read "BKR-002991EVT-012031Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:48:55 AMApprove Reject" and C read "BKR-002993EVT-012031Lee Kong Chian AuditoriumWednesday 2 December 2026, 19:00–21:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:48:56 AMDiffers from the eventStart 19:00 (event 14:00)End 21:00 (event 18:00)Approve Reject"; after B was rejected, A read "BKR-002994EVT-012033Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:49:00 AMApprove Reject" and C read "BKR-002996EVT-012033Lee Kong Chian AuditoriumWednesday 2 December 2026, 19:00–21:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:49:01 AMDiffers from the eventStart 19:00 (event 14:00)End 21:00 (event 18:00)Approve Reject". Both stayed Pending. |
| Status | Pass |
| Remarks | Commit: f0c7c9d · Evidence: tests/N2/evidence/N2-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
