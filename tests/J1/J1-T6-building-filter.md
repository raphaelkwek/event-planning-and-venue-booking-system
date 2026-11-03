# J1-T6 — Filtering by building or location returns only venues there, ignoring case

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T6 |
| Test Scenario | Filtering by building or location returns only venues there, ignoring case |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `science` in Building / location.<br>3. Click “Search”.<br>4. Change it to `FX ARTS BUILDING` and click “Search”.<br>5. Change it to `Nowhere Hall` and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · FX Auditorium and FX Seminar Room are in FX Science Block; FX Lecture Hall and the inactive FX Old Gym in FX Arts Building |
| Expected Result | `science`: FX Auditorium and FX Seminar Room. `FX ARTS BUILDING`: FX Lecture Hall only (FX Old Gym is inactive). `Nowhere Hall`: no venue and the empty-result message. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The building filter `science` (any case) listed FX Auditorium and FX Seminar Room; `FX ARTS BUILDING` listed FX Lecture Hall only (the inactive FX Old Gym absent); `Nowhere Hall` listed no venue and the empty-result message. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/j-venue-search.spec.ts › J1-T6 the building filter keeps only venues there, ignoring case, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |