# F1-T7 — Confirming an event writes a history entry like any other transition

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T7 |
| Test Scenario | Confirming an event writes a history entry like any other transition |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'APPROVED'` and end `now() + interval '30 days'`; note the **id**.<br>3. F5's confirmation action exists. |
| Test Steps | 1. Sign in as the event's assigned coordinator and confirm the event using F5's confirmation action.<br>2. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE' order by occurred_at desc limit 1;` |
| Expected Result | The row reads `APPROVED` → `CONFIRMED`, the coordinator's user id, `EVENT_COORDINATOR`, `CONFIRM`, and a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). F1 defines that Confirmed is
> reached by a `CONFIRM` transition that writes history; F5 (Sprint 4) builds the action. Until
> then this case is Not Executed and the transition is covered by the automated tests.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: F5's confirmation action (Sprint 4) does not exist, so there is no way to perform step 1. |
| Status | Not Executed |
| Remarks | Commit: · Evidence: — · Defect: — · Awaiting F5 (Sprint 4). |
| Executed By | |
| Date of Execution | |
