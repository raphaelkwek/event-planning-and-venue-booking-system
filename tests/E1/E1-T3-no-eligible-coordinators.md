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
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Requires a temporary `.env` change and service restart, not part of the shared standard environment — coordinate before running against the shared database. Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
