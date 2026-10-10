# J1-T5 — Boundary: a minimum capacity exactly equal to the chosen layout's capacity keeps the venue; one more removes it

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T5 |
| Test Scenario | Boundary: a minimum capacity exactly equal to the chosen layout's capacity keeps the venue; one more removes it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Choose `Classroom` in Layout.<br>3. Enter `80` in Minimum capacity.<br>4. Click “Search”.<br>5. Change Minimum capacity to `81` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Lecture Hall's Classroom layout holds exactly 80 |
| Expected Result | At 80: FX Auditorium and FX Lecture Hall. At 81: FX Auditorium only. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
