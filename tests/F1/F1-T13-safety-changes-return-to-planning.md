# F1-T13 — A request for safety changes returns a Safety Review event to Planning

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T13 |
| Test Scenario | A request for safety changes returns a Safety Review event to Planning |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'SAFETY_REVIEW'` and end `now() + interval '30 days'`; note the **id**.<br>3. U1's Safety Officer decision action exists. |
| Test Steps | 1. Sign in as the Safety Officer and record the decision using U1's action (request changes).<br>2. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select status from event.events where id = '<id>';` then `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE' order by occurred_at desc limit 1;` |
| Expected Result | The first query returns `PLANNING`. The history row reads `SAFETY_REVIEW` → `PLANNING`, the Safety Officer's user id, `SAFETY_OFFICER`, `REQUEST_SAFETY_CHANGES`, and a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-10-07 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria and CR-06.
> F1 defines the transition; U1 builds the Safety Officer's decision action. Until then this case is
> Not Executed and the transition is covered by the automated tests.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: U1's decision action does not exist, so there is no way to perform step 1. |
| Status | Not Executed |
| Remarks | Awaiting U1 (the Safety Officer's decision action) |
| Executed By | |
| Date of Execution | |
