# J2-T7 — Boundary: spaces only, a single character, and the wildcard characters % and _

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T7 |
| Test Scenario | Boundary: spaces only, a single character, and the wildcard characters % and _ |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Type three spaces in “Search by name or building”.<br>3. Click “Search”.<br>4. Change it to `x` and click “Search”.<br>5. Change it to `%` and click “Search”.<br>6. Change it to `_` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | Spaces only: treated as an empty search, so all active venues are listed with no error. `x`: every active venue whose name or building contains an x, including all the FX venues (“FX”). `%` and `_`: only venues whose name or building actually contains that character; none of the FX venues appear, so the characters are not treated as wildcards. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Three spaces were treated as an empty search (all active venues, no error); `x` listed every venue whose name or building contains an x, including the FX venues; `%` and `_` listed only venues containing the literal character and none of the FX venues. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/j-venue-search.spec.ts › J2-T7 boundary: spaces only, a single character, and the wildcard characters % and _, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
