# F1-T6 — Every status change on the way to Approved writes a full history entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T6 |
| Test Scenario | Every status change on the way to Approved writes a full history entry |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-APPROVED completed; note the request **id**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE' order by occurred_at;` |
| Expected Result | Exactly three rows, in this order:<br>1. `DRAFT` → `SUBMITTED`, `00000000-0000-0000-0000-000000000001`, `EVENT_ORGANISER`, `SUBMIT`<br>2. `SUBMITTED` → `UNDER_REVIEW`, `00000000-0000-0000-0000-000000000002`, `EVENT_COORDINATOR`, `OPEN_FOR_REVIEW`<br>3. `UNDER_REVIEW` → `APPROVED`, `00000000-0000-0000-0000-000000000002`, `EVENT_COORDINATOR`, `APPROVE`<br>Every row has a non-empty `occurred_at`. |
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
