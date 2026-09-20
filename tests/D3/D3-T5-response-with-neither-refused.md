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
| Created By | Seann |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Refused with "VALIDATION_FAILEDReply with a message, amend the request, or both.message: A message or an amendment is required.HTTP 400 · correlation 524899c5-170e-47d2-b73d-670e9864ed08". "Awaiting your response" is still shown and responded_at is null. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/D3/evidence/D3-T5.png · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
