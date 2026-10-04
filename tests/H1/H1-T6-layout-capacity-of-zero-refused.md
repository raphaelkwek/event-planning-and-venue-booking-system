# H1-T6 — A layout capacity of 0 is refused (boundary, just below)

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T6 |
| Test Scenario | A layout capacity of 0 is refused (boundary, just below) |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "New venue".<br>2. Enter the standard venue, but give the Classroom layout a capacity of `0`.<br>3. Click "Save venue".<br>4. Click "Venues". |
| Test Data | Layout `Classroom` capacity `0` |
| Expected Result | The save is refused. "Layout capacity must be a whole number greater than zero." is shown against the Classroom layout's capacity. No venue is created. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The save was refused with "Layout capacity must be a whole number greater than zero." against the Classroom layout's capacity. No venue was created. |
| Status | Pass |
| Remarks | Commit: 56eb0b2 · Evidence: tests/H1/evidence/H1-T6.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
