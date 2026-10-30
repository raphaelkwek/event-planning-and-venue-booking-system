# I3-T1 — A block over a Confirmed event's confirmed booking returns the event to Planning, with a status history entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T1 |
| Test Scenario | A block over a Confirmed event's confirmed booking returns the event to Planning, with a status history entry |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-CONFIRMED-BOOKING completed (`tests/I3/README.md`): FX-BOOKING's event, Confirmed, with a confirmed booking at `Lee Kong Chian Auditorium`, 2 December 2026 14:00–18:00.<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Open `Lee Kong Chian Auditorium`'s Unavailability page, enter 2 December 2026 16:00 to 19:00, Maintenance, `Stage rigging inspection`, and click "Review".<br>2. Read the review, then click "Record unavailability".<br>3. Sign in as the event's assigned coordinator, open the event, and read its status and status history. |
| Test Data | Block 16:00–19:00 over the booking 14:00–18:00 |
| Expected Result | The review says the event is Confirmed and will return to Planning. After recording, the event's status is Planning. Its status history ends with Confirmed → Planning by Venue Staff, at the time the block was recorded; the history entry's triggering action is `VENUE_BLOCKED`. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The review read "Record this unavailability?Lee Kong Chian Auditorium: Wednesday 2 December 2026, 16:00–19:00, Maintenance: Stage rigging inspectionIt will disrupt these. Each stays booked but will require reconfirmation, and its coordinator will be told that alternative arrangements are required.Booking BKR-004481 for EVT-013871, Wednesday 2 December 2026, 16:00–18:00EVT-013871 is Confirmed and will return to Planning, to be confirmed again. It won't be cancelled.CancelRecord unavailability". After recording: "Unavailability recorded. 1 booking now requires reconfirmation. EVT-013871 has returned to Planning.". The coordinator's page shows Planning; the last status history row reads "ConfirmedPlanningVenue Staff10/24/2026, 10:37:00 AM". Stored: CONFIRMED → PLANNING, VENUE_STAFF, VENUE_BLOCKED, at 2026-10-24T02:37:00.363Z (block recorded 2026-10-24T02:37:00.363Z). |
| Status | Pass |
| Remarks | Commit: d54760c · Evidence: tests/I3/evidence/I3-T1.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
