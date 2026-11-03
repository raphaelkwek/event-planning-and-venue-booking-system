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
| Actual Result | |
| Status | Not Executed |
| Remarks | Expected result revised for A4 (CR-05) on 2026-11-02; the earlier run checked the superseded behaviour. Re-run against the A4 build. |
| Executed By | |
| Date of Execution | |
