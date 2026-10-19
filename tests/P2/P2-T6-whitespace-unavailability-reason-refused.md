# P2-T6 — A whitespace-only unavailability reason is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T6 |
| Test Scenario | Whitespace does not satisfy the mandatory unavailability reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `techsupport@connectsphere.test`.<br>3. Create `P2 Wireless Microphone` exactly as in P2-T1 with total quantity 20.<br>4. It has no unavailability entry for 10–12 December 2026. |
| Test Steps | 1. Open `P2 Wireless Microphone`.<br>2. Under "Mark units unavailable", enter the test data, including three spaces in Reason.<br>3. Click "Mark unavailable".<br>4. Confirm the refusal appears and the recorded-unavailability list remains unchanged. |
| Test Data | Unavailable quantity: `2` · Start: `2026-12-10 09:00 Asia/Singapore` · End: `2026-12-12 17:00 Asia/Singapore` · Reason: `   ` (three spaces) |
| Expected Result | The save is refused with "Enter why the equipment is unavailable." against Reason. No unavailability entry for the stated period is shown after reopening the list, and the inventory total remains 20. |
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
