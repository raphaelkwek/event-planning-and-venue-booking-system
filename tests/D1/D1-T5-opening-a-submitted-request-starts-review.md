# D1-T5 — Opening a Submitted request moves it to Under Review and records the reviewer and the time

## Specification

| Item | Content |
|---|---|
| Test Case ID | D1-T5 |
| Test Scenario | Opening a Submitted request moves it to Under Review and records the reviewer and the time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-SUBMITTED completed; note the request id. |
| Test Steps | 1. Note the current time.<br>2. Go to http://localhost:5173 and sign in as `coordinator@connectsphere.test`.<br>3. Click "Review queue", then "Open" on the request.<br>4. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Query: `select status, reviewing_coordinator_id, review_started_at from event.events where id = '<id>';` |
| Expected Result | The status shows "Under Review" and Reviewer shows "Coordinator One". The query returns `UNDER_REVIEW`, reviewer `00000000-0000-0000-0000-000000000002`, and a `review_started_at` within one minute of the time noted. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The screen showed status "Under Review" and Reviewer "Coordinator One". The row reads UNDER_REVIEW, reviewing_coordinator_id 00000000-0000-0000-0000-000000000002, review_started_at Sun Sep 20 2026 15:27:14 GMT+0800 (Singapore Standard Time) — within a minute of 2026-09-20T07:27:12.634Z. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D1/evidence/D1-T5.png · Defect: — |
| Executed By | Chai Yichen |
| Date of Execution | 2026-09-20 |
