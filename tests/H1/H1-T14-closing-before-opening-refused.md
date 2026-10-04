# H1-T14 — Opening hours that close before they open are refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T14 |
| Test Scenario | Opening hours that close before they open are refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "New venue".<br>2. Enter the standard venue, but set Monday to open at `18:00` and close at `08:00`.<br>3. Click "Save venue".<br>4. Click "Venues". |
| Test Data | Monday: Opens `18:00`, Closes `08:00` |
| Expected Result | The save is refused with "Closing time must be later than opening time." against Monday. No venue is created. |
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
