# P2-T9 — Reduce total to exactly the overlapping reserved quantity (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T9 |
| Test Scenario | A total equal to the greatest overlapping reserved quantity is accepted |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Run `tests/P2/fixtures/reserved-bulk-stock.sql` in the SQL editor.<br>3. Signed in as `techsupport@connectsphere.test`.<br>4. Open `P2 Reserved Conference Chair` from "Equipment". It shows total quantity 12.<br>5. Reservations `EVT-700101` (6 units, 15 Dec 10:00–12:00) and `EVT-700102` (4 units, 15 Dec 10:30–11:30) overlap, so 10 units are reserved at the busiest point. |
| Test Steps | 1. Change Total quantity held from `12` to `10`.<br>2. Click "Save equipment type".<br>3. Return to "Equipment" and reopen `P2 Reserved Conference Chair`. |
| Test Data | Equipment type id: `22000000-0000-0000-0000-000000000001` · Previous total: `12` · New total: `10` · Concurrent reserved quantity: `10` |
| Expected Result | The update succeeds because the new total is not below the overlapping reserved quantity. "Equipment type saved." is shown, and the list and reopened editor both show total quantity 10. The two reservations remain unchanged. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: — · Evidence: — · Defect: — · Story: P2, Sprint 2 |
| Executed By | |
| Date of Execution | |
