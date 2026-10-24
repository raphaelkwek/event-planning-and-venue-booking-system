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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
