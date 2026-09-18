# E2-T3 — The nominee declines a reassignment proposal

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T3 |
| Test Scenario | The nominee declines; no assignment changes, and the outgoing coordinator remains active |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-REASSIGNMENT-PENDING completed. |
| Test Steps | 1. Sign out, sign in as the nominee coordinator.<br>2. Open the request from the review queue.<br>3. Under "Coordinator assignment", click "Decline". |
| Test Data | — |
| Expected Result | "Assigned coordinator" still shows the original outgoing coordinator. `select status from event.reassignment_proposals where event_id = '<id>'` shows `DECLINED`. `select * from event.assignments where event_id = '<id>' and is_active` still returns the original coordinator's row, unchanged. |
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
