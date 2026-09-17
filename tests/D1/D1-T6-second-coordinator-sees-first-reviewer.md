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
| Created By | Seann, via Claude |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
