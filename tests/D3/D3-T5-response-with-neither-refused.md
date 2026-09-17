# D3-T5 — A response with neither a message nor an amendment is refused and records no time

## Specification

| Item | Content |
|---|---|
| Test Case ID | D3-T5 |
| Test Scenario | A response with neither a message nor an amendment is refused and records no time |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. FX-AWAITING completed; note the request id; sign out.<br>3. Signed in as `organiser@connectsphere.test`, on the request page. |
| Test Steps | 1. Leave both the reply and the amendment empty.<br>2. Click "Send response".<br>3. In the Supabase SQL editor, run the query from Test Data. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`<br>Query: `select responded_at from event.clarifications where event_id = '<id>';` |
| Expected Result | The response is refused with `VALIDATION_FAILED` "Reply with a message, amend the request, or both.". "Awaiting your response" is still shown, and the query returns `responded_at` as null. |
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
