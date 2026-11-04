# R7-T6 — Negative (D-01): an addition that would go over capacity is not saved until it is confirmed

## Specification

| Item | Content |
|---|---|
| Test Case ID | R7-T6 |
| Test Scenario | Negative (D-01): an addition that would go over capacity is not saved until it is confirmed |
| Pre-conditions | 1. R7-T5's pre-conditions. |
| Test Steps | 1. Add Attendee One as in R7-T1 steps 1–2.<br>2. In the dialog, click "Cancel".<br>3. Through the API console, post the addition without `confirmOverCapacity`. |
| Test Data | 2 seats, both taken |
| Expected Result | Step 2: nothing added. Step 3: 409 `REGISTRATION_OVER_CAPACITY_UNCONFIRMED` with `capacity` 2 and `totalAfter` 3. No registration for Attendee One. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Cancel in the dialog closed it with nothing added (still two rows, no registration for Attendee One). From the API console, the addition without `confirmOverCapacity` answered 409 `REGISTRATION_OVER_CAPACITY_UNCONFIRMED` with details `capacity` 2 and `totalAfter` 3; still no registration for Attendee One. Run on CI's throwaway stack, with unique names in place of the card's literal names. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5eb3bfd · Evidence: tests/e2e/r-management.spec.ts › R7-T6 over capacity without confirming saves nothing, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41767254259 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
