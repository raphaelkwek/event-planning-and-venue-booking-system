# J1-T12 — A venue with a tentative hold overlapping the window is excluded

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T12 |
| Test Scenario | A venue with a tentative hold overlapping the window is excluded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `FX Science` in Building / location.<br>3. Set From to 14 December 2026, 14:30 and To to 14 December 2026, 15:30.<br>4. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Seminar Room has a hold on 14 December 2026, 14:00–16:00 (J1-FX-HELD) |
| Expected Result | FX Auditorium only. FX Seminar Room is not listed, because its hold covers the window. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Building 'J1T Science', window 14 Dec 14:30-15:30 returned Auditorium only; Seminar Room (hold 14:00-16:00) was excluded. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › excludes a venue with a tentative hold inside the window (J1-T12) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
