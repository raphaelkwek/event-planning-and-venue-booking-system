# D2-T7 — Asking for clarification emits the event the organiser's notification is built from

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T7 |
| Test Scenario | Asking for clarification emits the event the organiser's notification is built from |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | Query: `select envelope->>'messageType' as message_type, envelope->'payload'->>'eventReference' as reference, envelope->'payload'->>'ownerId' as owner_id, envelope->'payload'->>'requestedBy' as requested_by from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.clarification-requested`, `reference` = the noted reference, `owner_id` = `00000000-0000-0000-0000-000000000001` (the organiser the notification is for) and `requested_by` = the coordinator who asked. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

> **Revised 2026-09-20.** As written, this case asserted both that asking for clarification triggers
> the organiser's notification *and* that the organiser can read it in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which was planned for Sprint 1
> and not built (`documentation/planning/plan.md` §9.2); it is now **T2-T2**, Not Executed until T2
> ships. D2 owns the trigger, which is implemented, so the trigger is what this case checks.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Specification revised 2026-09-20; the previous record (Blocked, Joash, 2026-09-20) was against the pre-split specification. |
| Executed By | |
| Date of Execution | |
