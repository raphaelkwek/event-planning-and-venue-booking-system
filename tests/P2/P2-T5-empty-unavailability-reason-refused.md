# P2-T5 — An empty unavailability reason is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T5 |
| Test Scenario | Marking equipment unavailable without a reason is refused and stores nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `techsupport@connectsphere.test`.<br>3. Create `P2 Wireless Microphone` exactly as in P2-T1 with total quantity 20.<br>4. It has no unavailability entry for 10–12 December 2026. |
| Test Steps | 1. Open `P2 Wireless Microphone`.<br>2. Under "Mark units unavailable", enter the quantity and period and leave Reason empty.<br>3. Click "Mark unavailable".<br>4. Confirm the refusal appears and the recorded-unavailability list remains unchanged. |
| Test Data | Unavailable quantity: `2` · Start: `2026-12-10 09:00 Asia/Singapore` · End: `2026-12-12 17:00 Asia/Singapore` · Reason: empty |
| Expected Result | The save is refused with "Enter why the equipment is unavailable." against Reason. No unavailability entry for the stated period is shown after reopening the list, and the inventory total remains 20. |
| Created By | Yichen, via Codex |
| Date of Creation | 2026-10-07 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with the message on Reason; after a reload no out-of-service period and the total unchanged. Run on CI's throwaway stack, with unique names in place of the card's literal names. The card's 10 December 2026 period was moved to 10 December 2030, same times, so it never falls in the past. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: b91681d · Evidence: tests/e2e/o-equipment.spec.ts › P2-T5 marking equipment unavailable without a reason is refused and stores nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41516713095 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
