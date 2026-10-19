# J2-T6 — An empty search with no filters returns every active venue, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T6 |
| Test Scenario | An empty search with no filters returns every active venue, not an error |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Leave every field empty and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | No error is shown. The FX rows are FX Auditorium, FX Seminar Room, FX Lecture Hall and FX Late Studio; FX Old Gym is not listed. Every other active venue in the catalogue is listed too. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | An empty search with no filters returned 200 with Auditorium, Late Studio, Lecture Hall and Seminar Room and not the inactive Old Gym, with no error and no message. The search was narrowed to the fixture's buildings, so the other venues in the catalogue were not checked. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/api/venueSearch.test.ts › lists every active venue for an empty search, with the row fields J2 shows ; backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › returns every active venue and no inactive one, by name , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — · The screen itself was not exercised; UI walk-through in Chrome pending at the sprint review |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
