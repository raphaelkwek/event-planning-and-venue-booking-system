# H1-T12 — A rejected update leaves every stored venue field unchanged

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T12 |
| Test Scenario | A rejected update leaves every stored venue field unchanged |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "Edit" on `Lee Kong Chian Auditorium`.<br>2. Change Name to `Renamed Auditorium` and Maximum capacity to `0`.<br>3. Click "Save venue".<br>4. Click "Venues", then "Edit" on the venue again. |
| Test Data | Name `Renamed Auditorium` · Maximum capacity `0` |
| Expected Result | Step 3 is refused with "Maximum capacity must be a whole number greater than zero.". After step 4 the venue is still named `Lee Kong Chian Auditorium` with maximum capacity 300, and every other field is as the standard venue: the valid name change was not stored either. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
