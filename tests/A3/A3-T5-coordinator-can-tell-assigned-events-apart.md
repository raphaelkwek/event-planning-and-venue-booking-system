# A3-T5 — A coordinator can tell the events assigned to them from the rest

## Specification

| Item | Content |
|---|---|
| Test Case ID | A3-T5 |
| Test Scenario | A coordinator can tell the events assigned to them from the rest |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. In the root `.env`, set `EVENT_COORDINATOR_POOL=00000000-0000-0000-0000-000000000002,00000000-0000-0000-0000-000000000008` and restart the Event service; then reset test data again.<br>3. As `organiser@connectsphere.test`: FX-SUBMITTED with Event name `First assigned request`, then FX-SUBMITTED with Event name `Second assigned request`. The first is assigned to `coordinator@`, the second to `coordinator2@`. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue".<br>3. Click "All events", then "Assigned to me".<br>4. Afterwards, restore `EVENT_COORDINATOR_POOL` to its previous value and restart the Event service. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` |
| Expected Result | In step 2 both requests are listed; under "Assigned to", "First assigned request" shows "You" and "Second assigned request" shows "Coordinator Two". In step 3 only "First assigned request" is listed. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The queue listed both: "First assigned request" assigned to YOU and "Second assigned request" to Coordinator Two. "Assigned to me" on All events listed only "First assigned request". |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A3/evidence/A3-T5.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
