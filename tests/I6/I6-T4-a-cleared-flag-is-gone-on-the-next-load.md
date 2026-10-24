# I6-T4 — When the venue's times are changed so the bookings fit again, the calendar no longer shows the flag the next time it is loaded

## Specification

| Item | Content |
|---|---|
| Test Case ID | I6-T4 |
| Test Scenario | When the venue's times are changed so the bookings fit again, the calendar no longer shows the flag the next time it is loaded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. I6-T1 completed: both bookings flagged on the calendar. |
| Test Steps | 1. Sign in as `venuestaff@connectsphere.test`, edit `Lee Kong Chian Auditorium`, set the turnaround time back to `0` and save (H3).<br>2. Sign in as the coordinator of `<EVT-1>`, open the venue's availability and show 2 December 2026. |
| Test Data | Turnaround 0 |
| Expected Result | Both bookings are shown "Confirmed" with their event references and no flag. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the turnaround back to 0 the rows read "10:00–12:00 Confirmed EVT-014310" and "12:15–14:00 Confirmed EVT-014311", neither flagged. |
| Status | Pass |
| Remarks | Commit: e541b51 · Evidence: tests/I6/evidence/I6-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
