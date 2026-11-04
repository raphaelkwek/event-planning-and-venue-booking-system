# J1-T3 — Boundary: a minimum capacity exactly equal to a venue's maximum capacity keeps the venue; one more removes it

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T3 |
| Test Scenario | Boundary: a minimum capacity exactly equal to a venue's maximum capacity keeps the venue; one more removes it |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `200` in Minimum capacity.<br>3. Click “Search”.<br>4. Change Minimum capacity to `201` and click “Search”.<br>5. Change Minimum capacity to `300` and click “Search”.<br>6. Change Minimum capacity to `301` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Lecture Hall's maximum capacity is 200, FX Auditorium's is 300 |
| Expected Result | At 200: FX Auditorium and FX Lecture Hall. At 201: FX Auditorium only. At 300: FX Auditorium only. At 301: no venue, and the empty-result message appears (see J1-T20). Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Minimum capacity 200 listed FX Auditorium and FX Lecture Hall; 201 and 300 listed FX Auditorium only; 301 listed no venue and the empty-result message restating minimum capacity 301. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/j-venue-search.spec.ts › J1-T3 boundary: a minimum capacity equal to a venue's maximum keeps it, and one more drops it, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |