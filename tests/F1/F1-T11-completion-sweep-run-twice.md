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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
