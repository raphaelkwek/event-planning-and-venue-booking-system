# J1-T22 — Pre-filled filters can be changed and the search run again

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T22 |
| Test Scenario | Pre-filled filters can be changed and the search run again |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. FX-SEARCH-EVENT completed.<br>4. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Open `FX Symposium` and click “Find a venue”, as in J1-T21.<br>2. Clear Layout (choose “Any layout”).<br>3. Change Minimum capacity to `50`.<br>4. Untick `Wireless microphones` and `Hearing loop`.<br>5. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The fields accept the changes. The results are FX Auditorium, FX Seminar Room and FX Late Studio (window 12:00–14:00 on 14 December; FX Lecture Hall is still excluded by its maintenance block). Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After clearing Layout, setting minimum capacity 50 and unticking Wireless microphones and Hearing loop, the fields kept the changes and the results were FX Auditorium, FX Seminar Room and FX Late Studio (FX Lecture Hall excluded by its maintenance block). Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/j-venue-search.spec.ts › J1-T22 pre-filled filters remain editable, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
