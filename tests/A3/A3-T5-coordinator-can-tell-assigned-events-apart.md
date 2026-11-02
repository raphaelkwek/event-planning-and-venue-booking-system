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
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The coordinator's assigned event was marked "You" and the other coordinator's was not. (Assignment made by the Lead, since E3 replaced the coordinator pool.) Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/a-sign-in-and-access.spec.ts › A3-T5 a coordinator can tell the events assigned to them from the rest, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
