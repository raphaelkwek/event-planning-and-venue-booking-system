# N2-T3 — CR-01: a request is flagged when its occupied period, widened by the venue's setup time, overlaps a booking its own period doesn't

## Specification

| Item | Content |
|---|---|
| Test Case ID | N2-T3 |
| Test Scenario | CR-01: a request is flagged when its occupied period, widened by the venue's setup time, overlaps a booking its own period doesn't |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. `Lee Kong Chian Auditorium`'s setup time set to 30 minutes, its turnaround time left at 0 (H3-T1).<br>4. The N1 booking statement run with start 10:00, end 13:45, setup 0 and turnaround 0.<br>5. FX-BOOKING's coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00.<br>6. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests".<br>2. Read the request's row. |
| Test Data | Setup 30 · Booking 10:00–13:45 · Request 14:00–18:00, occupied from 13:30 |
| Expected Result | The request is flagged as conflicting with the booking, Wednesday 2 December 2026, 10:00–13:45: its occupied period starts at 13:30, before the booking ends, although its own period starts at 14:00. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-21 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With setup 30, the 14:00–18:00 request's row read "BKR-002984EVT-012023Lee Kong Chian AuditoriumWednesday 2 December 2026, 14:00–18:00Theatre150 attending——SuitableCoordinator One10/21/2026, 12:48:38 AMConflictConflicts with N1-FX-EVT-012024 (confirmed booking), Wednesday 2 December 2026, 10:00–13:45Approve Reject": its occupied period starts at 13:30, before the booking ends at 13:45. |
| Status | Pass |
| Remarks | Commit: f0c7c9d · Evidence: tests/N2/evidence/N2-T3.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-21 |
