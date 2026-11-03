# P2-T13 — Reduce total to one above the overlapping reserved quantity (boundary: just above)

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T13 |
| Test Scenario | A reduced total one above the overlapping reserved quantity is accepted |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Run `tests/P2/fixtures/reserved-bulk-stock.sql` in the SQL editor.<br>3. Signed in as `techsupport@connectsphere.test`.<br>4. Open `P2 Reserved Conference Chair` from "Equipment". It shows total quantity 12.<br>5. Reservations `EVT-700101` (6 units, 15 Dec 10:00–12:00) and `EVT-700102` (4 units, 15 Dec 10:30–11:30) overlap, so 10 units are reserved together. |
| Test Steps | 1. Change Total quantity held from `12` to `11`.<br>2. Click "Save equipment type".<br>3. Return to "Equipment" and reopen `P2 Reserved Conference Chair`.<br>4. In the SQL editor run: `select event_reference, quantity, starts_at, ends_at, status from equipment.bulk_reservations where equipment_type_id = '22000000-0000-0000-0000-000000000001' order by event_reference;` |
| Test Data | Previous total: `12` · New total: `11` · Overlapping reserved quantity: `10` · Times are in Asia/Singapore. |
| Expected Result | The update succeeds because the new total exceeds the overlapping reserved quantity. "Equipment type saved." is shown, and the list and reopened editor show total quantity 11. The two reservations retain their event references, quantities 6 and 4, original periods, and `RESERVED` status. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-08 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Reducing the total from 12 to 11 (one above the overlapping 10) saved with `Equipment type saved.` and the list and reopened editor showed 11; SQL showed both reservations unchanged and RESERVED. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/q-equipment-and-changes.spec.ts › P2-T13 a reduced total one above the overlapping reserved quantity is accepted, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
