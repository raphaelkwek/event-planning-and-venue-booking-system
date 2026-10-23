# I5-T3 — An open-ended block disrupts and flags every booking, hold and pending request whose occupied period ends after the block starts, however late

## Specification

| Item | Content |
|---|---|
| Test Case ID | I5-T3 |
| Test Scenario | An open-ended block disrupts and flags every booking, hold and pending request whose occupied period ends after the block starts, however late |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. The N1 booking statement run with start 10:00, end 12:00, setup 0 and turnaround 0 (`tests/N1/README.md`): another event's confirmed booking at `Lee Kong Chian Auditorium`, ending before the block starts.<br>4. FX-BOOKING's coordinator's request for `Lee Kong Chian Auditorium`, Theatre, 150, 2 December 2026 14:00–18:00, approved (M1): the event's confirmed booking.<br>5. A pending request by the same coordinator for the same venue, Theatre, 150, 9 December 2026 14:00–18:00.<br>6. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Open `Lee Kong Chian Auditorium`'s Unavailability page and enter start 2 December 2026 13:00, no end, Maintenance, `Roof leak repair`.<br>2. Click "Record unavailability" and read the review of what it would disrupt, then confirm.<br>3. In the SQL editor, read each booking's and request's Requires Reconfirmation flag. |
| Test Data | Block from 2 December 13:00, no end · Bookings 10:00–12:00 and 14:00–18:00 on 2 December · Pending request 9 December |
| Expected Result | The review lists the 14:00–18:00 booking and the 9 December request, and not the 10:00–12:00 booking. After confirming, those two are flagged Requires Reconfirmation and the 10:00–12:00 booking is not. Nothing is released, and the event's status is unchanged. |
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
