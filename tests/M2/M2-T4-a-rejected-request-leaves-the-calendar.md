# M2-T4 — After rejection the venue stays available for the period, and the request no longer shows as pending on the calendar

## Specification

| Item | Content |
|---|---|
| Test Case ID | M2-T4 |
| Test Scenario | After rejection the venue stays available for the period, and the request no longer shows as pending on the calendar |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The assigned coordinator has requested `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00; it shows as Pending on the calendar (L1-T6). |
| Test Steps | 1. As `venuestaff@connectsphere.test`, reject the request with reason `Not available`.<br>2. Open `Lee Kong Chian Auditorium`'s availability for 2 December 2026. |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | Wednesday 2 December 2026 has no Pending or Confirmed row, and 08:00–22:00 is free. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Before the rejection Wednesday 2 December 2026 showed 14:00–18:00 Pending; afterwards it had no Pending or Confirmed row and was free 08:00–22:00. |
| Status | Pass |
| Remarks | Commit: 9adf0ff · Evidence: tests/M2/evidence/M2-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-17 |
