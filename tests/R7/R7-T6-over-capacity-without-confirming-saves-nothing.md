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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r7Cards.test.ts › R7-T6 saves nothing over capacity until it is confirmed, naming the capacity and the new total, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
