# D2-T1 — Ask the organiser for clarification on a request under review

## Specification

| Item | Content |
|---|---|
| Test Case ID | D2-T1 |
| Test Scenario | Ask the organiser for clarification on a request under review |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-UNDER-REVIEW completed; note the request id. The coordinator is on the review screen. |
| Test Steps | 1. Enter the message under "Ask for clarification".<br>2. Click "Send clarification request".<br>3. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Account: `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!` · Message: `Please confirm the catering requirements.`<br>Query: `select requested_by, requested_at from event.clarifications where event_id = '<id>';` |
| Expected Result | Under "Clarifications" the message appears with its time and "Awaiting the organiser". The status shows "Awaiting Clarification". The query returns requested_by `00000000-0000-0000-0000-000000000002` and a `requested_at` matching the time shown. |
| Created By | Sahanya |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The message was listed with its time and "Awaiting the organiser", the status became "Awaiting Clarification", and the row holds requested_by 00000000-0000-0000-0000-000000000002 at Sun Sep 20 2026 15:27:28 GMT+0800 (Singapore Standard Time). |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D2/evidence/D2-T1.png · Defect: — |
| Executed By | Chai Yichen |
| Date of Execution | 2026-09-20 |
