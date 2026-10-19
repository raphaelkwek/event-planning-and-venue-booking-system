# I2-T5 — CR-01: a booking's period is its occupied period, setup and turnaround included, so a block over only its turnaround disrupts it, and one that only touches the turnaround's end doesn't

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T5 |
| Test Scenario | CR-01: a booking's period is its occupied period, setup and turnaround included, so a block over only its turnaround disrupts it, and one that only touches the turnaround's end doesn't |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The M1 booking statement run with start 10:00, end 12:00, setup 30 and turnaround 45 (`tests/M1/README.md`); it occupies 09:30–12:45. Note the returned event reference.<br>4. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s "Unavailability". |
| Test Steps | 1. Enter start 2 December 2026 12:30, end 2 December 2026 13:30, reason type Equipment failure, description `Lighting desk fault`, and click "Review".<br>2. Click "Cancel". Change the start to 2 December 2026 12:45 and click "Review". |
| Test Data | Account: `venuestaff@connectsphere.test` · The booking ends at 12:00; its turnaround runs to 12:45 |
| Expected Result | Step 1 lists the other event's booking, with the overlapping period 12:30–12:45. Step 2 says nothing is disrupted. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 12:30–13:30's dialog read "Record this unavailability?Lee Kong Chian Auditorium: Wednesday 2 December 2026, 12:30–13:30, Equipment failure: Lighting desk faultIt will disrupt these. Each stays booked but will require reconfirmation, and its coordinator will be told that alternative arrangements are required.Booking M1-FX-EVT-009047 for EVT-009047, Wednesday 2 December 2026, 12:30–12:45CancelRecord unavailability". 12:45–13:30's read "Record this unavailability?Lee Kong Chian Auditorium: Wednesday 2 December 2026, 12:45–13:30, Equipment failure: Lighting desk faultNothing is booked, held or requested in this period.CancelRecord unavailability". |
| Status | Pass |
| Remarks | Commit: a9a9cc4 · Evidence: tests/I2/evidence/I2-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
