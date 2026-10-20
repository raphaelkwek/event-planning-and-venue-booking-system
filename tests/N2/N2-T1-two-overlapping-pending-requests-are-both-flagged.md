# N2-T1 — Two pending requests for overlapping periods at one venue are both flagged in the queue, each naming the other

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T1 |
| Test Scenario | Two pending requests for overlapping periods at one venue are both flagged in the queue, each naming the other |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`).<br>3. The N1 second event statement run with the other coordinator's id (`tests/N1/README.md`): Faculty Awards Night, assigned to the coordinator FX-BOOKING's event doesn't have.<br>4. FX-BOOKING's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00 for FX-BOOKING's event. Note its reference (request A).<br>5. The other coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 16:00–20:00 for Faculty Awards Night. Note its reference (request B).<br>6. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Read request A's row and request B's row. |
| Test Data | Account: `venuestaff@connectsphere.test` · Request A 14:00–18:00 · Request B 16:00–20:00 |
| Expected Result | Both rows show "Conflict". Request A's row reads "Conflicts with &lt;B&gt; (pending request), Wednesday 2 December 2026, 16:00–20:00"; request B's reads "Conflicts with &lt;A&gt; (pending request), Wednesday 2 December 2026, 14:00–18:00". Both are still Pending, with Approve and Reject offered. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Request A's row read "BKR-002981EVT-012019Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:48:25 AMConflictConflicts with BKR-002982 (pending request), Wednesday 2 December 2026, 16:00–20:00Approve Reject". Request B's row read "BKR-002982EVT-012020Lee Kong Chian AuditoriumWednesday 2 December 2026, 16:00–20:00Theatre150 attending——SuitableCoordinator Two10/21/2026, 12:48:26 AMConflictConflicts with BKR-002981 (pending request), Wednesday 2 December 2026, 14:00–18:00Approve Reject". Both offered Approve and Reject. |
| Status | Pass |
| Remarks | Commit: f0c7c9d · Evidence: tests/N2/evidence/N2-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
