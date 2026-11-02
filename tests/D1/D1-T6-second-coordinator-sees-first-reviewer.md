# D1-T6 — A second coordinator opening a request under review sees the first reviewer's name, and the reviewer is not replaced

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T6 |
| Test Scenario | A second coordinator opening a request under review sees the first reviewer's name, and the reviewer is not replaced |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed (opened by `coordinator@connectsphere.test`); note the request id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator2@connectsphere.test`.<br>2. Click "Review queue", then "Open" on the request.<br>3. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Account: `coordinator2@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Query: `select reviewing_coordinator_id from event.events where id = '<id>';` |
| Expected Result | A message says the request is already under review and names the first reviewer, "Coordinator One". The query still returns `00000000-0000-0000-0000-000000000002`. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Coordinator Two saw "Already under review" and "Coordinator One opened this request first"; the stored reviewer stayed Coordinator One. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6080462 · Evidence: tests/e2e/d-review.spec.ts › D1-T6 a second coordinator opening a request under review sees the first reviewer, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41513983925 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
