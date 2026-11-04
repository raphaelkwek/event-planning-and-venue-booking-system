# B1-T5 — Submitting a request emits the event that a coordinator's notification is built from

## Specification

| Item | Content |
|---|---|
| Test Case ID | B1-T5 |
| Test Scenario | Submitting a request emits the event that a coordinator's notification is built from |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | Query: `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference, envelope->'data'->>'ownerId' as owner_id, published_at from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.submitted`, `reference` = the noted reference, and `owner_id` = `00000000-0000-0000-0000-000000000001`. `published_at` is null — no relay publishes the outbox yet (T2, Sprint 2), which this case does not assert. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

> **Revised 2026-09-20.** As written, this case asserted both that submission triggers the
> coordinator's notification *and* that the coordinator can read it in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which is counted in Sprint 2
> and is not built (`documentation/planning/plan.md` §9.1); it is now **T2-T1**, Not Executed until T2
> ships. B1 owns the trigger, which is implemented, so the trigger is what this case checks. Neither
> half was dropped.

> **Revised 2026-11-04.** Step 1 names the Supabase SQL editor, which an automated run can't use. The test does
> FX-SUBMITTED on CI's throwaway stack and runs the same query, unchanged, against that stack's database. The expected
> result is unchanged. Two things have moved since it was written: in the team's environment the outbox relay
> (EN-04.2) now publishes each row about a second after it is written, so there `published_at` is filled in; CI's stack
> runs without Kafka, so there it stays null. And since E3 (CR-05) no coordinator is assigned at submission: a
> coordinator hears of the request when the Lead assigns it, from `event.coordinator-assigned` (E1-T2). The
> `event.submitted` message this case checks is still written at submission, with the same fields.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Specification revised 2026-09-20; the previous record (Blocked, Joash, 2026-09-20) was against the pre-split specification. |
| Executed By | |
| Date of Execution | |
