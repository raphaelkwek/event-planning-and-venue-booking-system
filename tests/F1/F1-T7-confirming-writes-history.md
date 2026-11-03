# F1-T7 — Confirming the arrangements moves the event to Safety Review and writes a history entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T7 |
| Test Scenario | Confirming the arrangements moves the event to Safety Review and writes a history entry |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SEEDED with status `'APPROVED'` and end `now() + interval '30 days'`; note the **id**.<br>3. F5's confirmation action exists. |
| Test Steps | 1. Sign in as the event's assigned coordinator and confirm the arrangements using F5's confirmation action.<br>2. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Query: `select previous_status, new_status, actor_user_id, actor_role, triggering_action, occurred_at from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE' order by occurred_at desc limit 1;` |
| Expected Result | The row reads `APPROVED` → `SAFETY_REVIEW`, the coordinator's user id, `EVENT_COORDINATOR`, `CONFIRM_ARRANGEMENTS`, and a non-empty `occurred_at`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Revised 2026-10-07 for CR-06**: confirming the arrangements now leads to Safety Review, and only the
> Safety Officer's approval (U1) leads to Confirmed (see F1-T12).

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30). F1 defines that Safety Review is
> reached by a `CONFIRM_ARRANGEMENTS` transition that writes history; F5 (Sprint 4) builds the action. Until
> then this case is Not Executed and the transition is covered by the automated tests.

## Execution record

| Item | Content |
|---|---|
| Actual Result | The assigned coordinator confirmed the arrangements from the event page (status Safety Review); the newest status change read APPROVED → SAFETY_REVIEW, the coordinator's user id, EVENT_COORDINATOR, CONFIRM_ARRANGEMENTS, with a non-empty occurred_at. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: ceb525b · Evidence: tests/e2e/u-safety-and-assignment.spec.ts › F1-T7 confirming the arrangements writes a history entry from Approved to Safety Review, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41688315679 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
