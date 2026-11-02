# EN-15-T4 — S2 approve works as before when change-approval is on

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-15-T4 |
| Test Scenario | S2 approve works as before when change-approval is on |
| Pre-conditions | 1. As T3, but change-approval on. |
| Test Steps | 1. Sign in as C1.<br>2. POST the decision { decision: 'APPROVE' }. |
| Test Data | The same change request. |
| Expected Result | 200; the request is APPROVED and the event shows attendance 180. |
| Acceptance criterion | Approval is allowed when the flag is on. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the flag on, APPROVE returned 200, the request became APPROVED and attendance became 180 with the version bumped. |
| Status | Pass |
| Remarks | Commit: 62a261e · Evidence: backend/services/planning-core/tests/change/api/en15Cards.test.ts › EN-15-T4 approves as before while the flag is on, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41512676026 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
