# H1-T3 — A maximum capacity of 0 is refused (boundary, just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T3 |
| Test Scenario | A maximum capacity of 0 is refused (boundary, just below) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "New venue".<br>2. Enter the standard venue, but with Maximum capacity `0`.<br>3. Click "Save venue".<br>4. Click "Venues". |
| Test Data | Maximum capacity `0`; everything else as the standard venue |
| Expected Result | The save is refused. The message "Maximum capacity must be a whole number greater than zero." is shown under Maximum capacity. No venue is created: `Lee Kong Chian Auditorium` is not in the "Venues" list. |
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
