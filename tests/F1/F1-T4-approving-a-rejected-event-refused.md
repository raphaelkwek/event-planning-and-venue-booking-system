# F1-T4 — Approving a rejected event is refused, naming both statuses, and stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | F1-T4 |
| Test Scenario | Approving a rejected event is refused, naming both statuses, and stores nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-REJECTED completed; note the request **id**. Stay signed in as `coordinator@connectsphere.test`. |
| Test Steps | 1. In the Supabase SQL editor, run query 1 and note the count.<br>2. Open "API console". Set Method `POST`, Path `/api/v1/events/<id>/approve`, no Body. Click "Send".<br>3. Run query 1 again, then query 2. |
| Test Data | Query 1: `select count(*) from event.event_history where event_id = '<id>';`<br>Query 2: `select status from event.events where id = '<id>';` |
| Expected Result | Step 2 returns HTTP 409 with error code `STATUS_TRANSITION_NOT_PERMITTED` and the message "This event is Rejected and cannot move to Approved." The count in step 3 equals the count in step 1. Query 2 returns `REJECTED`. |
| Created By | Raphael |
| Date of Creation | 2026-09-30 |

> **Expected results are checked by the PR reviewer** against F1's acceptance criteria
> (§11.12's before-code confirmation was waived for F1 by the team on 2026-09-30).

## Execution record

| Item | Content |
|---|---|
| Actual Result | From the API console, approving the rejected event returned 409 STATUS_TRANSITION_NOT_PERMITTED with `This event is Rejected and cannot move to Approved.`; the history count was unchanged and the status was still REJECTED. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: aa700c3 · Evidence: tests/e2e/e-access-and-console.spec.ts › F1-T4 approving a rejected event is refused, naming both statuses, and stores nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
