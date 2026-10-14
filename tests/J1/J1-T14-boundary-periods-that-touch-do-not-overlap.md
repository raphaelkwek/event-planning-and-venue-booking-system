# J1-T14 — Boundary: a window that starts where a booking ends, or ends where a hold starts, is not excluded

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T14 |
| Test Scenario | Boundary: a window that starts where a booking ends, or ends where a hold starts, is not excluded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Set From to 14 December 2026, 12:00 and To to 14 December 2026, 14:00.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium's confirmed booking ends at 12:00; FX Seminar Room's hold starts at 14:00; FX Lecture Hall's maintenance block runs 09:00–13:00; FX Late Studio opens 12:00 |
| Expected Result | FX Auditorium, FX Seminar Room and FX Late Studio are listed. FX Lecture Hall is not, because its block overlaps 12:00–13:00. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Window 14 Dec 12:00-14:00 returned Auditorium, Late Studio and Seminar Room; Lecture Hall (block to 13:00) was excluded. Periods that only touch (booking ends 12:00, hold starts 14:00) did not exclude. Asserted at both the query and the API route. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › does not treat periods that merely touch as overlapping, on either side (J1-T14) ; backend/services/planning-core/tests/venue/api/venueSearch.test.ts › excludes a venue whose booking overlaps the window, and keeps one that only touches it (J1-T11, J1-T14) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
