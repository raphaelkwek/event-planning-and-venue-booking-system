# M1-T6 — CR-01: the overlap check uses occupied periods, setup and turnaround included

## Specification

| Item | Content |
|---|---|
| Test Case ID | M1-T6 |
| Test Scenario | CR-01: the overlap check uses occupied periods, setup and turnaround included |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The M1 booking statement run with start 10:00, end 12:00, setup 30 and turnaround 45; it occupies 09:30–12:45.<br>4. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 12:30–14:00.<br>5. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Booking requests", then "Approve" on the request, then "Approve request". |
| Test Data | Account: `venuestaff@connectsphere.test` · The other booking ends at 12:00, but its turnaround runs to 12:45 |
| Expected Result | The approval is refused, naming the other event and its occupied period, 09:30–12:45, including setup and turnaround. The request stays Pending. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The approval of 12:30–14:00 was refused: "BKR-001151 wasn't approved: Lee Kong Chian Auditorium is already booked for EVT-009139 (Wednesday 2 December 2026, 09:30–12:45), counting setup and turnaround time. Nothing was approved, and the request is still Pending." The request stayed PENDING. |
| Status | Pass |
| Remarks | Commit: ba2d786 · Evidence: tests/M1/evidence/M1-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
