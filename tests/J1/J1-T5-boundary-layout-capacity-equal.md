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
| Actual Result | Classroom layout with minimum capacity 80 returned Auditorium and Lecture Hall; 81 returned Auditorium only. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › keeps a venue whose layout capacity equals the minimum, and drops it for one more (J1-T5) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
