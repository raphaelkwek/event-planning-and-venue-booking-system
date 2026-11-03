# J1-T15 — A venue closed during the window under its operating hours is excluded

## Specification

| Item | Content |
|---|---|
| Test Case ID | J1-T15 |
| Test Scenario | A venue closed during the window under its operating hours is excluded |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Set From to 13 December 2026, 10:00 and To to 13 December 2026, 12:00.<br>3. Click “Search”.<br>4. Change the window to 14 December 2026, 07:00–09:00 and click “Search”.<br>5. Change the window to 14 December 2026, 21:00 – 15 December 2026, 09:00 and click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` · 13 December 2026 is a Sunday: every FX venue is closed. The FX venues open at 08:00 and close at 22:00 on weekdays, except FX Late Studio (12:00–20:00) |
| Expected Result | Sunday 10:00–12:00: no venue. Monday 07:00–09:00: no venue (it starts before opening). Monday 21:00 to Tuesday 09:00: no venue (closed overnight). Each shows the empty-result message. Judge only the rows whose name starts with `FX `; other venues in the shared database may also appear. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Sunday 10:00–12:00, Monday 07:00–09:00 and Monday 21:00 to Tuesday 09:00 each listed no venue and showed the empty-result message. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/j-venue-search.spec.ts › J1-T15 a venue closed during the window is excluded, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |