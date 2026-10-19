# P2-T7 — Equal unavailability start and end times are refused (boundary: exactly at)

## Specification

| Item | Content |
|---|---|
| Test Case ID | P2-T7 |
| Test Scenario | An unavailability period of zero duration is refused and stores nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `techsupport@connectsphere.test`.<br>3. Create `P2 Wireless Microphone` exactly as in P2-T1 with total quantity 20.<br>4. It has no unavailability entry for 10 December 2026. |
| Test Steps | 1. Open `P2 Wireless Microphone`.<br>2. Under "Mark units unavailable", enter the test data with identical start and end times.<br>3. Click "Mark unavailable".<br>4. Confirm the refusal appears and the recorded-unavailability list remains unchanged. |
| Test Data | Unavailable quantity: `2` · Start: `2026-12-10 09:00 Asia/Singapore` · End: `2026-12-10 09:00 Asia/Singapore` · Reason: `Battery compartments under repair` |
| Expected Result | The save is refused with "The end of the unavailable period must be later than the start." against the end time. No unavailability entry for that date is shown after reopening the list, and the inventory total remains 20. |
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
