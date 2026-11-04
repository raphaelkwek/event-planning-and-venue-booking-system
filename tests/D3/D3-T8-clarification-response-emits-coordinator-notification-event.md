# D3-T8 — The organiser's response emits the event the asking coordinator's notification is built from

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T8 |
| Test Scenario | The organiser's response emits the event the asking coordinator's notification is built from |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed, then the organiser responds with `Answered.`; note the request **id** and the **reference**. |
| Test Steps | 1. In the Supabase SQL editor, run the query from Test Data with the noted id. |
| Test Data | Query: `select envelope->>'type' as message_type, envelope->'data'->>'eventReference' as reference, envelope->'data'->>'requestedBy' as requested_by, envelope->'data'->>'respondedBy' as responded_by from event.outbox where message_key = '<id>' order by created_at;` |
| Expected Result | One row has `message_type` = `event.clarification-responded`, `reference` = the noted reference, `requested_by` = the coordinator who asked (the notification is for them, not for whoever is reviewing now) and `responded_by` = `00000000-0000-0000-0000-000000000001`. |
| Created By | Seann |
| Date of Creation | 2026-09-17 |

> **Revised 2026-09-20.** As written, this case asserted both that the response triggers the asking
> coordinator's notification *and* that the coordinator can read it in a notifications list. The
> reading half belongs to **T2 — Read and manage my notifications**, which is counted in Sprint 2
> and is not built (`documentation/planning/plan.md` §9.1); it is now **T2-T3**, Not Executed until T2
> ships. D3 owns the trigger, which is implemented, so the trigger is what this case checks.

> **Revised 2026-11-04.** Step 1 names the Supabase SQL editor, which an automated run can't use. The test does the
> pre-conditions on CI's throwaway stack and runs the same query, unchanged, against that stack's database. The expected
> result is unchanged.

## Execution record

| Item | Content |
|---|---|
| Actual Result | FX-AWAITING was done through the API (Coordinator One asked); the organiser then opened the request, typed "Answered." as the reply and clicked Send response; the reply showed and the status went back to Under Review. The card's query returned one event.clarification-responded row with the request's reference, requested_by 00000000-0000-0000-0000-000000000002 (Coordinator One, who asked) and responded_by 00000000-0000-0000-0000-000000000001. Run on CI's throwaway stack, with unique names in place of the card's literal names; the card's query ran unchanged against that stack's database in place of the Supabase SQL editor. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/event-messages.spec.ts › D3-T8 the organiser's response emits the event the asking coordinator's notification is built from, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
