# I2-T4 — Before confirming, Venue Staff are shown each confirmed booking the block would disrupt, with its booking reference, event reference and overlapping period; a booking the block only touches isn't listed

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T4 |
| Test Scenario | Before confirming, Venue Staff are shown each confirmed booking the block would disrupt, with its booking reference, event reference and overlapping period; a booking the block only touches isn't listed |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed. Note the event's reference.<br>3. The assigned coordinator's request for `Lee Kong Chian Auditorium`, Theatre, 2 December 2026 14:00–18:00 has been approved (M1-T3). Note its booking reference.<br>4. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s "Unavailability". |
| Test Steps | 1. Enter start 2 December 2026 16:00, end 2 December 2026 19:00, reason type Maintenance, description `Stage rigging inspection`, and click "Review".<br>2. Click "Cancel". Change the start to 2 December 2026 18:00 and click "Review". |
| Test Data | Account: `venuestaff@connectsphere.test` · The booking is 14:00–18:00 |
| Expected Result | Step 1's dialog lists the booking with its booking reference, the event's reference and the overlapping period Wednesday 2 December 2026, 16:00–18:00. Step 2's dialog says nothing is disrupted: 18:00 only touches the booking's end. Nothing is recorded until "Record unavailability" is clicked. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 16:00–19:00's dialog read "Record this unavailability?Lee Kong Chian Auditorium: Wednesday 2 December 2026, 16:00–19:00, Maintenance: Stage rigging inspectionIt will disrupt these. Each stays booked but will require reconfirmation, and its coordinator will be told that alternative arrangements are required.Booking BKR-001114 for EVT-009045, Wednesday 2 December 2026, 16:00–18:00CancelRecord unavailability". 18:00–19:00's read "Record this unavailability?Lee Kong Chian Auditorium: Wednesday 2 December 2026, 18:00–19:00, Maintenance: Stage rigging inspectionNothing is booked, held or requested in this period.CancelRecord unavailability". Nothing was recorded, and the booking isn't flagged. |
| Status | Pass |
| Remarks | Commit: a9a9cc4 · Evidence: tests/I2/evidence/I2-T4.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-19 |
