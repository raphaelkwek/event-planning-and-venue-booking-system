# B1-T5 — Submitting a request emits the event that a coordinator's notification is built from

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T5 |
| Test Scenario | Submitting a request emits the event that a coordinator's notification is built from |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | Query: `select envelope->>'messageType' as message_type, envelope->'payload'->>'eventReference' as reference, envelope->'payload'->>'ownerId' as owner_id, published_at from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.submitted`, `reference` = the noted reference, and `owner_id` = `00000000-0000-0000-0000-000000000001`. `published_at` is null — no relay publishes the outbox yet (T2, Sprint 2), which this case does not assert. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

> **Revised 2026-09-20.** As written, this case asserted both that submission triggers the
> coordinator's notification *and* that the coordinator can read it in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which is counted in Sprint 2
> and is not built (`documentation/planning/plan.md` §9.1); it is now **T2-T1**, Not Executed until T2
> ships. B1 owns the trigger, which is implemented, so the trigger is what this case checks. Neither
> half was dropped.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Specification revised 2026-09-20; the previous record (Blocked, Joash, 2026-09-20) was against the pre-split specification. |
| Executed By | |
| Date of Execution | |
