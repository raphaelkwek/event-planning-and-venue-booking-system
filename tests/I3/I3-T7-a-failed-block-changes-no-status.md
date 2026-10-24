# I3-T7 — A block that fails to be created changes no event's status

## Specification

| Item | Content |
|---|---|
| Test Case ID | I3-T7 |
| Test Scenario | A block that fails to be created changes no event's status |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-CONFIRMED-BOOKING completed.<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. On `Lee Kong Chian Auditorium`'s Unavailability page, enter 2 December 2026 16:00 to 15:00 (an end before the start), Maintenance, `Stage rigging inspection`, and click "Review".<br>2. In the SQL editor, read the event's status and the booking's flag. |
| Test Data | End before start |
| Expected Result | The block is refused with "The end must be after the start."; the event is still Confirmed and the booking isn't flagged. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-24 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The block was refused with "The end must be after the start."; the event is still CONFIRMED, the booking's flag is false, and no history entry was added. |
| Status | Pass |
| Remarks | Commit: d54760c · Evidence: tests/I3/evidence/I3-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-24 |
