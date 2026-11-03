# P2-T10 — Reducing total below overlapping reservations is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T10 |
| Test Scenario | A reduction below the greatest overlapping reserved quantity names every affected event and leaves the total unchanged |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Run `tests/P2/fixtures/reserved-bulk-stock.sql` in the SQL editor.<br>3. Signed in as `techsupport@connectsphere.test`.<br>4. Open `P2 Reserved Conference Chair` from "Equipment". It shows total quantity 12.<br>5. Reservations `EVT-700101` (6 units, 15 Dec 10:00–12:00) and `EVT-700102` (4 units, 15 Dec 10:30–11:30) overlap, so 10 units are reserved at the busiest point. |
| Test Steps | 1. Change Total quantity held from `12` to `9`.<br>2. Click "Save equipment type".<br>3. Return to "Equipment" and reopen `P2 Reserved Conference Chair`. |
| Test Data | Equipment type id: `22000000-0000-0000-0000-000000000001` · Previous total: `12` · Attempted total: `9` · Affected reservations: `EVT-700101` = 6 units; `EVT-700102` = 4 units |
| Expected Result | The update is refused. The message names `EVT-700101` with 6 reserved units and `EVT-700102` with 4 reserved units. After reopening the type, total quantity is still 12. Both reservations retain their references, quantities, periods, and Reserved state. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Reducing the total from 12 to 9 returned 409 and the page showed `Total quantity cannot be reduced to 9; affected reservations: …` naming both events (6 and 4) with no `Equipment type saved.`; after reopening, the total was still 12 and both reservations were unchanged. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/q-equipment-and-changes.spec.ts › P2-T10 a reduction below the overlapping reservations is refused naming them and changes nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
