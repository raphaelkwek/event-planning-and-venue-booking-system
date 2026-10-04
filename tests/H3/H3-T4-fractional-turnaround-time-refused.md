# H3-T4 — A turnaround time that is not a whole number of minutes is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T4 |
| Test Scenario | A turnaround time that is not a whole number of minutes is refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "Edit" on the venue.<br>2. Enter `15.5` in "Turnaround time (minutes)".<br>3. Click "Save venue".<br>4. Click "Venues", then "Edit" on the venue again. |
| Test Data | Turnaround `15.5` |
| Expected Result | The save is refused with "Turnaround time must be a whole number of minutes, 0 or more." under Turnaround time. Reopened, the turnaround time is still 0. |
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
