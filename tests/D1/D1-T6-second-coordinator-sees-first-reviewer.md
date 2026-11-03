# D1-T6 — A coordinator cannot open a request assigned to another coordinator, and claims nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T6 |
| Test Scenario | A coordinator cannot open a request assigned to another coordinator, and claims nothing |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed (opened by `coordinator@connectsphere.test`); note the request id; sign out. |
| Test Steps | 1. Go to http://localhost:5173 and sign in as `coordinator2@connectsphere.test`.<br>2. Click "Review queue" and look for the request.<br>3. In the address bar, go to `#/review/<id>`.<br>4. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Account: `coordinator2@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Query: `select reviewing_coordinator_id from event.events where id = '<id>';` |
| Expected Result | Step 2: the request is not in the queue. Step 3: the page shows "No event with that reference is assigned to you." and no detail of the request. The query still returns `00000000-0000-0000-0000-000000000002`. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

> **Revised for A4 (CR-05) on 2 Nov 2026.** A second coordinator no longer sees the first reviewer: the request isn't assigned to them, so they can't open it at all.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Coordinator Two's Review queue did not list the request; opening its address showed "No event with that reference is assigned to you." (HTTP 404) and no detail; the stored reviewer stayed Coordinator One. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated, browser E2E in CI (EN-14). Commit: 6f5ed43 · Evidence: tests/e2e/d-review.spec.ts › D1-T6 a coordinator cannot open a request assigned to another coordinator, and claims nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41604122084 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
