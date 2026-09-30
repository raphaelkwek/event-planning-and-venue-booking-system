# F1-T8 — A Confirmed event whose end has passed becomes Completed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T8 |
| Test Scenario | A Confirmed event whose end has passed becomes Completed, recorded as a system change |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'CONFIRMED'` and end `now() - interval '1 minute'`; note the **id**. |
| Test Steps | 1. From the repo root, run `npm run jobs:complete-events`.<br>2. In the Supabase SQL editor, run both queries from Test Data. |
| Test Data | Query 1: `select status from event.events where id = '<id>';`<br>Query 2: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE';` |
| Expected Result | The command exits without error, and its output includes a line "event completed" carrying the noted id. Query 1 returns `COMPLETED`. Query 2 returns one row: `CONFIRMED` → `COMPLETED`, `actor_user_id` null, `SYSTEM`, `COMPLETE`, and a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). Until F5 exists, a Confirmed event can only be seeded (FX-SEEDED).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
