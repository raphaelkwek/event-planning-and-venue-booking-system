# J1-T20 — When nothing matches, the list is empty and a message restates the filters, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T20 |
| Test Scenario | When nothing matches, the list is empty and a message restates the filters, not an error |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `science` in Building / location.<br>3. Enter `500` in Minimum capacity.<br>4. Choose `Theatre` in Layout.<br>5. Tick `Projector` under Facilities.<br>6. Set From to 14 December 2026, 12:00 and To to 14 December 2026, 14:00.<br>7. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The list is empty. A message states that no venue matches and names every filter applied: the building `science`, a minimum capacity of 500, the layout Theatre, the facility Projector and the window 14 December 2026 12:00–14:00. It is an informational message, not a red error, and no error code is shown. Changing a filter and clicking “Search” shows the new result. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Building 'J1T', minimum capacity 500, Theatre, Projector, window 14 Dec 12:00-14:00 returned 200 with an empty list, no error, five applied filters and the message 'No active venue matches all of these filters: available from 2026-12-14 12:00 to 2026-12-14 14:00 (Singapore time); minimum capacity 500 (Theatre layout); building or location containing "J1T"; layout Theatre; facilities Projector.'. Changing a filter and searching again was not exercised. |
| Status | Pass (automated, API level) |
| Remarks | Commit: cb3b9d8 · Evidence: backend/services/planning-core/tests/venue/api/venueSearch.test.ts › answers a search that matches nothing with 200, an empty list and a message restating the filters (J1-T20) , CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/38427990873 · Defect: — · The screen itself was not exercised; UI walk-through in Chrome pending at the sprint review |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-10-13 |
