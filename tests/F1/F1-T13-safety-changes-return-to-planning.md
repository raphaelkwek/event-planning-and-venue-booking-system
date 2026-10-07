# F1-T13 — A request for safety changes returns a Safety Review event to Planning

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T13 |
| Test Scenario | A request for safety changes returns a Safety Review event to Planning |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'SAFETY_REVIEW'` and end `now() + interval '30 days'`; note the **id**.<br>3. U1 is merged and its seed has created `safety@connectsphere.test`. |
| Test Steps | 1. Sign in as `safety@connectsphere.test` (the Safety Officer account U1's seed adds) and record the decision with U1's "request changes" action, with the reason `Move the stage away from the fire exit.`.<br>2. In the Supabase SQL editor, run queries 1 and 2 from Test Data. |
| Test Data | Query 1: `select status from event.events where id = '<id>';`<br>Query 2: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE' order by occurred_at desc limit 1;` |
| Expected Result | Query 1 returns `PLANNING`. The history row reads `SAFETY_REVIEW` → `PLANNING`, the Safety Officer's user id, `SAFETY_OFFICER`, `REQUEST_SAFETY_CHANGES`, and a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-10-07 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria and CR-06.
> F1 defines the transition; U1 builds the Safety Officer's decision action. Until then this case is
> Not Executed and the transition is covered by the automated tests.
> The FX-SEEDED end of `now() + interval '30 days'` keeps the event clear of the completion sweep while it is being tested.
> Steps (screen and button names) are to be made concrete when U1 merges, by U1's assignee.
> CR-06 proposes Planning as the target; CQ-08 also asks which stage "request changes" returns to, so this expected result may change with the customer's answer.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run: U1's decision action does not exist, so there is no way to perform step 1. |
| Status | Not Executed |
| Remarks | Awaiting U1 (the Safety Officer's decision action) |
| Executed By | |
| Date of Execution | |
