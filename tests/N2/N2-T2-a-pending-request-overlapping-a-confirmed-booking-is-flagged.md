# N2-T2 — A pending request whose period overlaps a confirmed booking at the venue is flagged, naming the booking and its period

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T2 |
| Test Scenario | A pending request whose period overlaps a confirmed booking at the venue is flagged, naming the booking and its period |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 13:00, end 15:00, setup 0 and turnaround 0. The booking's reference is `N1-FX-` followed by the returned event reference.<br>4. FX-BOOKING's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Read the request's row. |
| Test Data | The confirmed booking is 13:00–15:00 |
| Expected Result | The row shows "Conflict" and reads "Conflicts with N1-FX-EVT-… (confirmed booking), Wednesday 2 December 2026, 13:00–15:00". |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The request's row read "BKR-002983EVT-012021Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:48:33 AMConflictConflicts with N1-FX-EVT-012022 (confirmed booking), Wednesday 2 December 2026, 13:00–15:00Approve Reject". |
| Status | Pass |
| Remarks | Commit: f0c7c9d · Evidence: tests/N2/evidence/N2-T2.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
