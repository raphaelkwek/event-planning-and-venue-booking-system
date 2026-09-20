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
| Created By | Shawmya |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Blocked: there is no notifications list to look in. T2 (Read and manage my notifications) was planned for Sprint 1 but not built — assignment writes an outbox row, and no notification record, read model or screen exists. |
| Status | Blocked |
| Remarks | Commit: b0ef6ee (working tree modified) · Evidence: — · Defect: — |
| Executed By | Joash |
| Date of Execution | 2026-09-20 |
