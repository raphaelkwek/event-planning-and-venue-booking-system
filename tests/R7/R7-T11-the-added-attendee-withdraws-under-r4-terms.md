# R7-T11 — The added attendee can withdraw their own registration under the same terms as R4

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T11 |
| Test Scenario | The added attendee can withdraw their own registration under the same terms as R4 |
| Pre-conditions | 1. R7-T1 done.<br>2. Signed in as `attendee@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Test Steps | 1. Open "My registrations" and withdraw the added registration (R4-T1 steps 1–3).<br>2. Repeat R7-T1 with FX-R-EVENT's `<DEADLINE>` `now() - interval '1 minute'`, and try to withdraw. |
| Test Data | The addition from R7-T1 |
| Expected Result | Step 1: `Withdrawn` with its time; places remaining rises by one. Step 2: refused naming the withdrawal deadline (`WITHDRAWAL_DEADLINE_PASSED`), nothing changes. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T11 lets the added attendee withdraw under R4's terms, deadline included, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
