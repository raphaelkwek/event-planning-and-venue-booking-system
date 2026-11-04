# D2-T7 — Asking for clarification emits the event the organiser's notification is built from

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T7 |
| Test Scenario | Asking for clarification emits the event the organiser's notification is built from |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | Query: `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference, envelope->'data'->>'ownerId' as owner_id, envelope->'data'->>'requestedBy' as requested_by from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.clarification-requested`, `reference` = the noted reference, `owner_id` = `00000000-0000-0000-0000-000000000001` (the organiser the notification is for) and `requested_by` = the coordinator who asked. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

> **Revised 2026-09-20.** As written, this case asserted both that asking for clarification triggers
> the organiser's notification *and* that the organiser can read it in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which is counted in Sprint 2
> and is not built (`documentation/planning/plan.md` §9.1); it is now **T2-T2**, Not Executed until T2
> ships. D2 owns the trigger, which is implemented, so the trigger is what this case checks.

> **Revised 2026-11-04.** Step 1 names the Supabase SQL editor, which an automated run can't use. The test does the
> pre-conditions on CI's throwaway stack and runs the same query, unchanged, against that stack's database. The expected
> result is unchanged.

## Execution record

| Item | Content |
|---|---|
| Actual Result | FX-SUBMITTED and FX-ASSIGNED (the Lead assigning Coordinator One, as E3 has it) were done through the API; Coordinator One then opened the request from the Review queue (Under Review), typed "Please confirm the expected attendance." under Ask for clarification and clicked Send clarification request (Awaiting Clarification). The card's query returned one event.clarification-requested row with the request's reference, owner_id 00000000-0000-0000-0000-000000000001 and requested_by 00000000-0000-0000-0000-000000000002, Coordinator One, who asked. Run on CI's throwaway stack, with unique names in place of the card's literal names; the card's query ran unchanged against that stack's database in place of the Supabase SQL editor. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/event-messages.spec.ts › D2-T7 asking for clarification emits the event the organiser's notification is built from, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
