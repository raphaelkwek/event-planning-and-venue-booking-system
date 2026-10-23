# I5-T1 — A block can be recorded with no end, and stays active until Venue Staff remove it

## Specification

| Item | Content |
|---|---|
| Test Case ID | I5-T1 |
| Test Scenario | A block can be recorded with no end, and stays active until Venue Staff remove it |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-BOOKING completed (`tests/L1/README.md`).<br>3. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Open Venues, click "View" on `Lee Kong Chian Auditorium`, then "Unavailability".<br>2. Enter start date 2 December 2026, start time 13:00, leave the end date and end time empty, choose reason type Maintenance, description `Roof leak repair`, and click "Record unavailability" (confirming the review).<br>3. In the SQL editor, read the block's status and end. |
| Test Data | Start 2 December 2026 13:00 · No end · Maintenance · `Roof leak repair` |
| Expected Result | "Unavailability recorded." is shown, and the block is listed as starting Wednesday 2 December 2026, 13:00, with no end, marked open-ended. It is `ACTIVE` with no end date in the database. |
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
