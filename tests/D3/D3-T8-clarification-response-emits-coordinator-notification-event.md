# D3-T8 — The organiser's response emits the event the asking coordinator's notification is built from

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T8 |
| Test Scenario | The organiser's response emits the event the asking coordinator's notification is built from |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed, then the organiser responds with `Answered.`; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | Query: `select envelope->>'messageType' as message_type, envelope->'payload'->>'eventReference' as reference, envelope->'payload'->>'requestedBy' as requested_by, envelope->'payload'->>'respondedBy' as responded_by from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.clarification-responded`, `reference` = the noted reference, `requested_by` = the coordinator who asked (the notification is for them, not for whoever is reviewing now) and `responded_by` = `00000000-0000-0000-0000-000000000001`. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

> **Revised 2026-09-20.** As written, this case asserted both that the response triggers the asking
> coordinator's notification *and* that the coordinator can read it in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which is counted in Sprint 2
> and is not built (`documentation/planning/plan.md` §9.1); it is now **T2-T3**, Not Executed until T2
> ships. D3 owns the trigger, which is implemented, so the trigger is what this case checks.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Specification revised 2026-09-20; the previous record (Blocked, Joash, 2026-09-20) was against the pre-split specification. |
| Executed By | |
| Date of Execution | |
