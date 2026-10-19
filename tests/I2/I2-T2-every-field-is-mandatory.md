# I2-T2 — Every field of a block is mandatory; a block missing any of them is refused, naming each, and nothing is created

## Specification

| Item | Content |
|---|---|
| Test Case ID | I2-T2 |
| Test Scenario | Every field of a block is mandatory; a block missing any of them is refused, naming each, and nothing is created |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-BOOKING completed.<br>3. Signed in as `venuestaff@connectsphere.test`, on `Lee Kong Chian Auditorium`'s "Unavailability". |
| Test Steps | 1. Leave every field empty and click "Review".<br>2. Enter only the start and end of the Test Data, type three spaces as the description, and click "Review".<br>3. In the SQL editor, count the venue's blocks. |
| Test Data | Start 9 December 2026 09:00 · End 9 December 2026 13:00 |
| Expected Result | Step 1 names the start, the end, the reason type and the description as required. Step 2 names the reason type and the description. No dialog opens and the venue has no block. |
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
