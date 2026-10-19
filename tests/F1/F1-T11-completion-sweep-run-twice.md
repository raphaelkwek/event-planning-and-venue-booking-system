# F1-T11 — Running the completion job twice completes an event once

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T11 |
| Test Scenario | Running the completion job twice completes an event once and writes one history entry |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'CONFIRMED'` and end `now() - interval '1 minute'`; note the **id**. |
| Test Steps | 1. From the repo root, run `npm run jobs:complete-events`.<br>2. Run it again.<br>3. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select count(*) from event.event_history where event_id = '<id>' and triggering_action = 'COMPLETE';` |
| Expected Result | Both runs exit without error. Only the first run's output has an "event completed" line carrying the noted id. The query returns `1`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Both runs exited 0. Run 1 logged "event completed" with the noted id (completed 1); run 2 had no line carrying it (completed 0). The query returned `1`. |
| Status | Pass |
| Remarks | Commit: 3d313c1 · Evidence: tests/F1/evidence/F1-T11-2026-10-07.txt · Defect: — |
| Executed By | Raphael, via automated testing |
| Date of Execution | 2026-10-07 |
