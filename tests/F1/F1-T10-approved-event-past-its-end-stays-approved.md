# F1-T10 — An Approved event whose end has passed is not completed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T10 |
| Test Scenario | An Approved event whose end has passed is not completed, because it was never confirmed |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'APPROVED'` and end `now() - interval '1 minute'`; note the **id**. |
| Test Steps | 1. From the repo root, run `npm run jobs:complete-events`.<br>2. In the Supabase SQL editor, run both queries from Test Data. |
| Test Data | Query 1: `select status from event.events where id = '<id>';`<br>Query 2: `select count(*) from event.event_history where event_id = '<id>';` |
| Expected Result | The command exits without error, and no output line carries the noted id. Query 1 returns `APPROVED`. Query 2 returns `0`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). Only Confirmed events complete
> — a decision on a gap in AC6, confirmed by Raphael on 2026-09-30 (spec §2, decision 2).

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
