# D5-T7 — Rejecting a request emits the event the organiser's notification is built from, carrying the reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | D5-T7 |
| Test Scenario | Rejecting a request emits the event the organiser's notification is built from, carrying the reason |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-REJECTED completed; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | Query: `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference, envelope->'data'->>'ownerId' as owner_id, envelope->'data'->>'reason' as reason from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.rejected`, `reference` = the noted reference, `owner_id` = `00000000-0000-0000-0000-000000000001` and `reason` = `No suitable venue is available.` — the reason travels with the event, so the notification can show it without reading the event record. |
| Created By | Seann Khoo |
| Date of Creation | 2026-09-17 |

> **Revised 2026-09-20.** As written, this case asserted both that rejection triggers the organiser's
> notification *and* that the organiser can read it, with the reason, in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which is counted in Sprint 2
> and is not built (`documentation/planning/plan.md` §9.1); it is now **T2-T5**, Not Executed until T2
> ships. D5 owns the trigger, which is implemented, so the trigger is what this case checks.

> **Revised 2026-11-04.** Step 1 names the Supabase SQL editor, which an automated run can't use. The test does the
> pre-conditions on CI's throwaway stack and runs the same query, unchanged, against that stack's database. The expected
> result is unchanged.

## Execution record

| Item | Content |
|---|---|
| Actual Result | FX-SUBMITTED and FX-ASSIGNED (the Lead assigning Coordinator One, as E3 has it) were done through the API; Coordinator One opened the request from the Review queue, clicked Reject, entered the reason "No suitable venue is available." and clicked Reject request (status Rejected). The card's query returned one event.rejected row with the request's reference, owner_id 00000000-0000-0000-0000-000000000001 and reason "No suitable venue is available.". Run on CI's throwaway stack, with unique names in place of the card's literal names; the card's query ran unchanged against that stack's database in place of the Supabase SQL editor. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/event-messages.spec.ts › D5-T7 rejecting a request emits the event the organiser's notification is built from, carrying the reason, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
