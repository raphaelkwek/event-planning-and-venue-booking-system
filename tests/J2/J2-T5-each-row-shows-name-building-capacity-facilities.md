# J2-T5 — Each result row shows the venue's name, building, maximum capacity and key facilities

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T5 |
| Test Scenario | Each result row shows the venue's name, building, maximum capacity and key facilities |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `lecture` in “Search by name or building”.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Lecture Hall: FX Arts Building, maximum capacity 200, facilities Projector, Wireless microphones, Stage lighting |
| Expected Result | One row for FX Lecture Hall with the columns Name `FX Lecture Hall`, Building / location `FX Arts Building`, Maximum capacity `200` and Facilities `Projector, Wireless microphones, Stage lighting`. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Search 'lecture' returned Lecture Hall with name 'J1T Lecture Hall', building 'J1T Arts Building', maximum capacity 200 and facilities Projector, Wireless microphones, Stage lighting. The column headings were not exercised. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › returns the fields a result row shows (J2 AC3) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — · The screen itself was not exercised; UI walk-through in Chrome pending at the sprint review |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
