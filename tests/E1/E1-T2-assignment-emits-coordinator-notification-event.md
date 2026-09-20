# E1-T2 — Assigning a coordinator emits the event that coordinator's notification is built from

## Specification

| Item | Content |
|---|---|
| Test Case ID | E1-T2 |
| Test Scenario | Assigning a coordinator emits the event that coordinator's notification is built from, identifying the event and the assigned coordinator |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. "New request" → enter the standard request → "Submit request".<br>3. Note the request **id**, the **reference**, and the coordinator named in "Assigned coordinator".<br>4. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | The standard request.<br>Query: `select envelope->>'messageType' as message_type, envelope->'payload'->>'eventReference' as reference, envelope->'payload'->>'eventName' as event_name, envelope->'payload'->>'coordinatorId' as coordinator_id, envelope->'payload'->>'assignmentRule' as assignment_rule from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.coordinator-assigned`, `reference` = the noted reference and `event_name` = `Annual Research Symposium` — the event is identifiable from the event alone. `coordinator_id` is the user id of the coordinator the screen named as assigned (E1's round-robin means either seeded coordinator may be assigned; see the Accounts table in `tests/README.md`), and `assignment_rule` names the rule that chose them. |
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

> **Revised 2026-09-20.** As written, this case asserted both that assignment triggers the assigned
> coordinator's notification *and* that the coordinator can read it in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which is counted in Sprint 2
> and is not built (`documentation/planning/plan.md` §9.1); it is now **T2-T6**, Not Executed until T2
> ships. E1 owns the trigger — which coordinator is assigned, and that the assignment is announced —
> and that is what this case checks.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Specification revised 2026-09-20; the previous record (Blocked, Joash, 2026-09-20) was against the pre-split specification. |
| Executed By | |
| Date of Execution | |
