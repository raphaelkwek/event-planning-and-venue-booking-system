# H1-T5 — A maximum capacity that is not a whole number is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T5 |
| Test Scenario | A maximum capacity that is not a whole number is refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "New venue".<br>2. Enter the standard venue, but with Maximum capacity `150.5`.<br>3. Click "Save venue".<br>4. Click "Venues". |
| Test Data | Maximum capacity `150.5` |
| Expected Result | The save is refused with "Maximum capacity must be a whole number greater than zero." under Maximum capacity. No venue is created. |
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
