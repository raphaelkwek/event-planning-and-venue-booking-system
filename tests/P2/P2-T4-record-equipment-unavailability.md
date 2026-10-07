# P2-T4 — Record equipment unavailability with a reason and period

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T4 |
| Test Scenario | Technical Support Staff mark a quantity of equipment unavailable for a valid period with a stated reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `techsupport@connectsphere.test`.<br>3. Create `P2 Wireless Microphone` exactly as in P2-T1 with total quantity 20, or open that type if this is a controlled continuation of P2-T1.<br>4. The type has no unavailability entry for 10 December 2026. |
| Test Steps | 1. Open `P2 Wireless Microphone` from "Equipment".<br>2. Under "Mark units unavailable", enter the unavailable quantity, start, end, and reason from the test data.<br>3. Click "Mark unavailable".<br>4. Reopen the equipment type's recorded-unavailability list. |
| Test Data | Unavailable quantity: `2` · Start: `2026-12-10 09:00 Asia/Singapore` · End: `2026-12-10 09:01 Asia/Singapore` · Reason: `Battery compartments under repair` |
| Expected Result | "Unavailability recorded." is shown. The unavailability list contains one active entry for quantity 2, from 10 December 2026 09:00 through 10 December 2026 09:01, with the exact reason `Battery compartments under repair`. The inventory total remains 20. |
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
