# E2-T4 — Proposing reassignment to the already-assigned coordinator is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | E2-T4 |
| Test Scenario | Nominating the coordinator who is already assigned is refused and creates no history entry |
| Pre-conditions | 1. Standard environment running and test data reset.<br>2. FX-SUBMITTED completed. |
| Test Steps | 1. Sign in as the coordinator shown in "Assigned coordinator".<br>2. Open the request.<br>3. "Propose reassignment" → enter that same coordinator's own user id → "Send proposal". |
| Test Data | Nominee user id = the signed-in coordinator's own id. |
| Expected Result | The dialog stays open and shows a refusal: "This coordinator is already assigned to the event." No "Pending reassignment" state appears on the page after closing the dialog. `select count(*) from event.reassignment_proposals where event_id = '<id>'` is `0`. |
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
