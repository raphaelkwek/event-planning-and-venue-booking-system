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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
