# H1-T7 — A venue with no layout recorded is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | H1-T7 |
| Test Scenario | A venue with no layout recorded is refused |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. Signed in as `venuestaff@connectsphere.test`. |
| Test Steps | 1. Click "Venues", then "New venue".<br>2. Enter the standard venue, then click "Remove" on every layout.<br>3. Click "Save venue".<br>4. Click "Venues". |
| Test Data | No layouts |
| Expected Result | The save is refused with "Record at least one layout." shown under Layouts. No venue is created. |
| Created By | Seann Khoo |
| Date of Creation | 2026-10-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The save was refused with "Record at least one layout." under Layouts. No venue was created. |
| Status | Pass |
| Remarks | Commit: 56eb0b2 · Evidence: tests/H1/evidence/H1-T7.png · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-04 |
