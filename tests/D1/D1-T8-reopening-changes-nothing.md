# D1-T8 — Reopening a request already under review changes nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T8 |
| Test Scenario | Reopening a request already under review changes nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed; note the request id. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>2. Click "Review queue", then "Open" on the request.<br>3. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Query: `select count(*) from event.event_history where event_id = '<id>' and entry_type = 'STATUS_CHANGE';` |
| Expected Result | The status is still "Under Review" and Reviewer is still "Coordinator One". The query returns `2` — the submission and the first opening — not `3`. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Reopening left the status, reviewer and review time unchanged (read back from the database). Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D1-T8 reopening a request already under review changes nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
