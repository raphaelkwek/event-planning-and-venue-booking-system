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
| Actual Result | With the flag off, REJECT with a reason returned 200 and stored REJECTED with the reason; a malformed body still gives 400 VALIDATION_FAILED. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: backend/services/planning-core/tests/change/api/en15Cards.test.ts › EN-15-T5 (two tests), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
