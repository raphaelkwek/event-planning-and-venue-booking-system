# J1-T7 — A required layout keeps only venues that offer it

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T7 |
| Test Scenario | A required layout keeps only venues that offer it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Choose `Boardroom` in Layout.<br>3. Click “Search”.<br>4. Choose `Theatre` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · Boardroom is offered only by FX Seminar Room; Theatre by FX Auditorium, FX Lecture Hall and FX Late Studio |
| Expected Result | `Boardroom`: FX Seminar Room only. `Theatre`: FX Auditorium, FX Lecture Hall and FX Late Studio. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Layout Boardroom returned Seminar Room only; Theatre returned Auditorium, Late Studio and Lecture Hall; Banquet returned no venue. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › keeps only venues that offer the required layout (J1-T7) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
