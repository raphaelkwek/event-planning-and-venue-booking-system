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
| Actual Result | The notice; after a reload one entry with the quantity, period and reason (active); total quantity unchanged. Run on CI's throwaway stack, with unique names in place of the card's literal names. The card's 10 December 2026 period was moved to 10 December 2030, same times, so it never falls in the past. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: b91681d · Evidence: tests/e2e/o-equipment.spec.ts › P2-T4 technical support mark a quantity unavailable for a valid period with a reason, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41516713095 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
