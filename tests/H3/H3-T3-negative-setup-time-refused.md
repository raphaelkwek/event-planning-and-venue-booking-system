# H3-T3 — A setup time of -1 minute is refused and nothing is stored (boundary, just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T3 |
| Test Scenario | A setup time of -1 minute is refused and nothing is stored (boundary, just below) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "Edit" on the venue.<br>2. Enter `-1` in "Setup time (minutes)".<br>3. Click "Save venue".<br>4. Click "Venues", then "Edit" on the venue again. |
| Test Data | Setup `-1` |
| Expected Result | The save is refused with "Setup time must be a whole number of minutes, 0 or more." under Setup time. Reopened, the setup time is still 0. |
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
