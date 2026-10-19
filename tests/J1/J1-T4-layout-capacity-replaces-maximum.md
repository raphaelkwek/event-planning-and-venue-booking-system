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
| Actual Result | Classroom layout with minimum capacity 100 returned Auditorium only; Lecture Hall (maximum 200, Classroom 80) was excluded. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › compares with the chosen layout's capacity instead of the maximum (J1-T4) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
