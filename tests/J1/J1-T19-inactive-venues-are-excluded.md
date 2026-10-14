# J1-T19 — Inactive venues are never returned, however well they match

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T19 |
| Test Scenario | Inactive venues are never returned, however well they match |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `400` in Minimum capacity.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Old Gym is inactive and holds 500 with every facility and accessibility feature |
| Expected Result | No venue among the FX rows: FX Old Gym is not listed although it is the only FX venue that holds 400. The empty-result message appears. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Minimum capacity 400 returned no venue (the inactive Old Gym holds 500 and was not returned); Stage lighting, Theatre, minimum capacity 250 also returned no venue. The empty-result message for this input was not asserted in that test; the message is asserted generically by the J1-T20 test. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/repo/venueSearch.test.ts › never returns an inactive venue, whatever else it matches (J1-T19) ; backend/services/planning-core/tests/venue/api/venueSearch.test.ts › answers a search that matches nothing with 200, an empty list and a message restating the filters (J1-T20) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
