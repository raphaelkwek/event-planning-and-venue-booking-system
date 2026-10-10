# J1-T4 — With a layout chosen, capacity is the layout's own capacity, not the venue's maximum

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T4 |
| Test Scenario | With a layout chosen, capacity is the layout's own capacity, not the venue's maximum |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Choose `Classroom` in Layout.<br>3. Enter `100` in Minimum capacity.<br>4. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · Classroom capacity: FX Auditorium 120, FX Lecture Hall 80, FX Seminar Room 40 (FX Lecture Hall's maximum is 200) |
| Expected Result | FX Auditorium only. FX Lecture Hall is not listed even though its maximum capacity of 200 is above 100, because its Classroom layout holds 80. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
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
