# E1-T2 — The assigned coordinator is notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | E1-T2 |
| Test Scenario | The coordinator assigned by E1 receives a notification identifying the event |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`). |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. "New request" → enter the standard request → "Submit request".<br>3. Sign out, sign in as the coordinator named in "Assigned coordinator".<br>4. Look for a notification naming the event. |
| Test Data | The standard request. |
| Expected Result | The assigned coordinator sees a notification identifying the event by name/reference. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Event Service writes an `event.coordinator-assigned` row to its outbox (verifiable via the SQL editor: `select * from event.outbox where topic = 'connectsphere.event.coordinator-assigned.v1'`), but there is no Notification service or UI to read it yet — plan.md §3 lists Notification as a separate, not-yet-built service, and the SPA has no notifications screen. |
| Status | Blocked |
| Remarks | Blocked until the Notification service and its UI exist. Commit: · Evidence: · Defect: |
| Executed By | Shawmya, via Claude |
| Date of Execution | 2026-09-18 |
