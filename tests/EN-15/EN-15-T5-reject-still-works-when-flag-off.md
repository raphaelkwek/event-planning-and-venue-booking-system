# EN-15-T5 — Rejecting still works when change-approval is off

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-15-T5 |
| Test Scenario | Rejecting still works when change-approval is off |
| Pre-conditions | 1. As T3 (flag off). |
| Test Steps | 1. Sign in as C1.<br>2. POST { decision: 'REJECT', reason: 'No larger hall' }. |
| Test Data | The same change request. |
| Expected Result | 200; the request is REJECTED with the reason. Rejection changes nothing on the event, so it is safe to leave open, and it lets a coordinator clear the queue while approvals are paused. |
| Acceptance criterion | Only approval is gated, as the flag's name says. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
