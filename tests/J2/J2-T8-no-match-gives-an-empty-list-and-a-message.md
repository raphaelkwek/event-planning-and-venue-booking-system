# J2-T8 — A search that matches nothing gives an empty list and a message naming the search, not an error

## Specification

| Item | Content |
|---|---|
| Test Case ID | J2-T8 |
| Test Scenario | A search that matches nothing gives an empty list and a message naming the search, not an error |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SEARCH completed.<br>3. Signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. Click “Find a venue” in the navigation.<br>2. Enter `zzzz-no-such-venue` in “Search by name or building”.<br>3. Click “Search”. |
| Test Data | Account: `coordinator@connectsphere.test` |
| Expected Result | The list is empty and a message says no venue matches the search `zzzz-no-such-venue`. It is not shown as an error. |
| Created By | Joash |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | An empty list and a message naming the search text; no error. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/h-venues.spec.ts › J2-T8 a search that matches nothing gives an empty list and a message naming the search, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
