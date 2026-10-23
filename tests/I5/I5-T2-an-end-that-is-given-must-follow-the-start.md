# I5-T2 — When an end is given it must still be later than the start (boundary: equal to the start, and one minute after)

## Specification

| Item | Content |
|---|---|
| Test Case ID | I5-T2 |
| Test Scenario | When an end is given it must still be later than the start (boundary: equal to the start, and one minute after) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s Unavailability page. |
| Test Steps | 1. Enter start 2 December 2026 13:00 and end 2 December 2026 13:00, Maintenance, `Roof leak repair`, and click "Record unavailability".<br>2. Change the end time to 13:01 and record it again. |
| Test Data | End = start, then end = start + 1 minute |
| Expected Result | Step 1 is refused: "The end must be after the start." is shown under the end, and no block is created. Step 2 records a block ending at 13:01. |
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
