# E2-T2 — The nominee accepts a reassignment proposal

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T2 |
| Test Scenario | The nominee accepts; the outgoing assignment closes, the nominee becomes the active coordinator, and the organiser sees the updated point of contact |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed. |
| Test Steps | 1. Sign out, sign in as the nominee coordinator.<br>2. Open the request from the review queue.<br>3. Under "Coordinator assignment", click "Accept". |
| Test Data | — |
| Expected Result | "Assigned coordinator" now shows the nominee. The nominee can now Approve/Reject the request; the previous coordinator no longer can (their "Propose reassignment" button and decision buttons are for a request they are no longer assigned to). Signing in as `organiser@connectsphere.test` and opening the request shows the nominee as "Assigned coordinator". `select is_active from event.assignments where event_id = '<id>' and coordinator_id = '<outgoing id>'` is `false`; the row for the nominee is `true`. |
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
