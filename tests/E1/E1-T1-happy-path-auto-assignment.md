# E1-T1 — Submitting an event auto-assigns an eligible coordinator

## Specification

| Item | Content |
|---|---|
| Test Case ID | E1-T1 |
| Test Scenario | Submitting an event assigns an eligible coordinator automatically, recording who, when, and how, and shows that coordinator to the organiser as the point of contact |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`).<br>2. `EVENT_COORDINATOR_POOL` names at least one eligible coordinator (the default `.env.example` value lists both seeded coordinators). |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. "New request" → enter the standard request → "Submit request".<br>3. Read the "Assigned coordinator" field on the confirmation/detail screen. |
| Test Data | The standard request (`tests/README.md`). |
| Expected Result | The request is created at status Submitted. "Assigned coordinator" shows a coordinator's display name (`Coordinator One` or `Coordinator Two`), not "Awaiting assignment". Querying `event.assignments` for the event's id (SQL editor) shows exactly one row with `is_active = true`, `assignment_rule` set, and `assigned_at` populated. |
| Created By | Shawmya, via Claude |
| Date of Creation | 2026-09-18 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
