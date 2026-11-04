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

> **Revised 2026-11-04.** Step 1 names the Supabase SQL editor, which an automated run can't use. The test does
> FX-APPROVED on CI's throwaway stack and runs the same query, unchanged, against that stack's database. The expected
> result is unchanged: FX-ASSIGNED, the Lead's assignment since E3 (CR-05), changes no status, so it writes no
> `STATUS_CHANGE` row.

## Execution record

| Item | Content |
|---|---|
| Actual Result | FX-SUBMITTED and FX-ASSIGNED (the Lead assigning Coordinator One, as E3 has it) were done through the API; Coordinator One opened the request from the Review queue (Under Review) and clicked Approve. The card's query returned exactly three rows, in this order: DRAFT → SUBMITTED, 00000000-0000-0000-0000-000000000001, EVENT_ORGANISER, SUBMIT; SUBMITTED → UNDER_REVIEW, 00000000-0000-0000-0000-000000000002, EVENT_COORDINATOR, OPEN_FOR_REVIEW; UNDER_REVIEW → APPROVED, 00000000-0000-0000-0000-000000000002, EVENT_COORDINATOR, APPROVE. Every row had a non-empty occurred_at, in time order. Run on CI's throwaway stack, with unique names in place of the card's literal names; the card's query ran unchanged against that stack's database in place of the Supabase SQL editor. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: c0f7183 · Evidence: tests/e2e/f1-history.spec.ts › F1-T6 every status change on the way to Approved writes a full history entry, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
