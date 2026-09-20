# A2-T7 — A request made without signing in is refused and returns no data

## Specification

| Item | Content |
|---|---|
| Test Case ID | A2-T7 |
| Test Scenario | A request made without signing in is refused and returns no data |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. Signed in as `organiser@connectsphere.test` (the console needs a session to open; the request itself is sent without one). |
| Test Steps | 1. Click "API console", then the "Request without signing in" preset.<br>2. Check that "Send without a token" is ticked, and click "Send". |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!` · Path: `/event/api/v1/events/queue` |
| Expected Result | HTTP 401. The body contains only `error`, with code `UNAUTHENTICATED` and message "A valid bearer token is required." There is no `items` array and no event, venue, equipment or registration field. |
| Created By | Chai Yichen |
| Date of Creation | 2026-09-17 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | HTTP 401. The body held only "error" — code UNAUTHENTICATED, message "A valid bearer token is required." — with no items array and no event, venue, equipment or registration field. |
| Status | Pass |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: tests/A2/evidence/A2-T7.png · Defect: — |
| Executed By | Seann Khoo |
| Date of Execution | 2026-09-20 |
