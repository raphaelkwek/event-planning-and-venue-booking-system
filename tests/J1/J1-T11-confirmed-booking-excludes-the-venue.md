# J1-T11 — A venue with a confirmed booking overlapping the window is excluded

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T11 |
| Test Scenario | A venue with a confirmed booking overlapping the window is excluded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `FX Science` in Building / location.<br>3. Set From to 14 December 2026, 10:30 and To to 14 December 2026, 11:30.<br>4. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium has a confirmed booking on 14 December 2026, 10:00–12:00 (J1-FX-CONFIRMED) |
| Expected Result | FX Seminar Room only. FX Auditorium is not listed, because its confirmed booking covers the whole window. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Building 'J1T Science', window 14 Dec 10:30-11:30 returned Seminar Room only; Auditorium (confirmed booking 10:00-12:00) was excluded. Asserted at both the query and the API route. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/api/venueSearch.test.ts › excludes a venue whose booking overlaps the window, and keeps one that only touches it (J1-T11, J1-T14) ; backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › excludes a venue with a confirmed booking inside the window (J1-T11) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
