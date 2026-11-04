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
| Actual Result | After the organiser added Attendee One, the event showed `2 places remaining`; Attendee One withdrew the added registration from My registrations (200), the row showed `Withdrawn` and the stored withdrawal time, and the event then showed `3 places remaining`. On an event whose withdrawal deadline had passed, the withdrawal of an added registration answered 422 `WITHDRAWAL_DEADLINE_PASSED`, the dialog named the deadline, and after Keep my place the row and the database still read Registered with no withdrawal. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: a406635 · Evidence: tests/e2e/r-management.spec.ts › R7-T11 the added attendee withdraws under R4's terms, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41773031885 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
