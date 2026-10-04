# H3-T5 — A setup time that is not a number is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | H3-T5 |
| Test Scenario | A setup time that is not a number is refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-VENUE completed; signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "Edit" on the venue.<br>2. Enter `half an hour` in "Setup time (minutes)".<br>3. Click "Save venue". |
| Test Data | Setup `half an hour` |
| Expected Result | The save is refused with "Setup time must be a whole number of minutes, 0 or more." under Setup time, and nothing is stored. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The save was refused with "Setup time must be a whole number of minutes, 0 or more." under Setup time; nothing was stored (setup still 0, no new history row). |
| Status | Pass |
| Remarks | Commit: 6514ab8 · Evidence: tests/H3/evidence/H3-T5.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
