# F1-T1 — The database refuses a status outside the permitted statuses

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T1 |
| Test Scenario | The database refuses a status outside the permitted statuses |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the request **id**. |
| Test Steps | 1. In the Supabase SQL editor, run query 1 from Test Data with the noted id.<br>2. Run query 2. |
| Test Data | Query 1: `update event.events set status = 'ARCHIVED' where id = '<id>';`<br>Query 2: `select status from event.events where id = '<id>';` |
| Expected Result | Query 1 fails with a check-constraint violation naming `events_status_check`. Query 2 returns `SUBMITTED`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Revised 2026-10-07 for CR-06**, which adds Safety Review: there are now eleven permitted statuses. The steps and expected result are unchanged.

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | Query 1 failed: ERROR 23514, new row violates check constraint "events_status_check". Query 2 returned `SUBMITTED`. |
| Status | Pass |
| Remarks | Pre-condition deviation: the Submitted request was made with FX-SEEDED (status `'SUBMITTED'`) rather than FX-SUBMITTED, because the run was done without signing in to the app; the row is the same shape. Commit: 3d313c1 · Evidence: tests/F1/evidence/F1-T1-2026-10-07.txt · Defect: — |
| Executed By | Raphael, via automated testing |
| Date of Execution | 2026-10-07 |
