# J2-T3 — A search never returns an inactive venue

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T3 |
| Test Scenario | A search never returns an inactive venue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `old gym` in “Search by name or building”.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Old Gym is inactive |
| Expected Result | No venue among the FX rows, and the empty-result message names the search `old gym`. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The inactive venue matching the text was not returned; the active one was. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/h-venues.spec.ts › J2-T3 a search never returns an inactive venue, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
