# J1-T2 — With no layout chosen, minimum capacity is compared with the venue's maximum capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T2 |
| Test Scenario | With no layout chosen, minimum capacity is compared with the venue's maximum capacity |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `100` in Minimum capacity.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium holds 300, FX Lecture Hall 200, FX Late Studio 100, FX Seminar Room 60 |
| Expected Result | FX Auditorium, FX Lecture Hall and FX Late Studio are listed (FX Late Studio's maximum is exactly 100). FX Seminar Room is not. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With no layout and minimum capacity 100 the search returned Auditorium, Late Studio and Lecture Hall (Late Studio's maximum is exactly 100), and not Seminar Room. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › compares with the maximum capacity when no layout is chosen (J1-T2) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
