# E1-T3 — Submission succeeds with no eligible coordinators

## Specification

| Item | Content |
|---|---|
| Test Case ID | E1-T3 |
| Test Scenario | With no eligible coordinator in the pool, the event still submits successfully, is left unassigned, and appears in the Awaiting Assignment queue |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. `EVENT_COORDINATOR_POOL` temporarily set to an empty string in the event service's `.env`, and the event service restarted. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. "New request" → enter the standard request → "Submit request".<br>3. Read the "Assigned coordinator" field on the request.<br>4. Sign out, sign in as `coordinator@connectsphere.test`, open "Review queue", and find the request. |
| Test Data | The standard request. |
| Expected Result | The request is created at status Submitted (submission is not refused). "Assigned coordinator" shows "Awaiting assignment" to the organiser. `select * from event.assignments where event_id = '<id>'` (SQL editor) returns no rows. In the coordinator's review queue, the request's row also shows "Awaiting assignment" in the assigned-to column, so it is visible to any coordinator despite carrying no assignment. |
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Blocked: the pre-condition needs EVENT_COORDINATOR_POOL set to an empty string and the Event service restarted. The pool is read once at start-up, and this run drives one shared service on :8082 that the other cases depend on, so the script does not restart it. Run this case by hand, or give the suite its own Event service instance. |
| Status | Blocked |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
