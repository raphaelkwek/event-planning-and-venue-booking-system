# F1-T9 — A Confirmed event whose end has not passed stays Confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T9 |
| Test Scenario | A Confirmed event whose end has not passed stays Confirmed (boundary: just before the end) |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'CONFIRMED'` and end `now() + interval '1 hour'`; note the **id**. |
| Test Steps | 1. From the repo root, run `npm run jobs:complete-events`.<br>2. In the Supabase SQL editor, run both queries from Test Data. |
| Test Data | Query 1: `select status from event.events where id = '<id>';`<br>Query 2: `select count(*) from event.event_history where event_id = '<id>';` |
| Expected Result | The command exits without error, and no output line carries the noted id. Query 1 returns `CONFIRMED`. Query 2 returns `0`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). "Just before" is an hour here so that the case cannot drift across the
> boundary while it is being run; the millisecond boundaries (just before, exactly at, just after)
> are covered by the automated tests, where the time is fixed.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
