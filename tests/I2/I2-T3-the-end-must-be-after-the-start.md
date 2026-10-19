# I2-T3 — Boundary: the end must be later than the start; an end equal to or before the start is refused with that as the cause, and nothing is created

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T3 |
| Test Scenario | Boundary: the end must be later than the start; an end equal to or before the start is refused with that as the cause, and nothing is created |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s "Unavailability". |
| Test Steps | 1. Enter start 9 December 2026 13:00, end 9 December 2026 13:00, reason type Maintenance and description `Test`, and click "Review".<br>2. Change the end to 9 December 2026 12:59 and click "Review".<br>3. Change the end to 9 December 2026 13:01 and click "Review", then "Record unavailability". |
| Test Data | Account: `venuestaff@connectsphere.test` |
| Expected Result | Steps 1 and 2 show, under the end, "The end must be after the start.", and nothing is created. Step 3 records a block 13:00–13:01. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-19 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
