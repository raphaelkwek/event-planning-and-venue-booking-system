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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
