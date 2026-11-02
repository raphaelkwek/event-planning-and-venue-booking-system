# R2-T3 — CR-03 (CQ-04): an event with two confirmed venues accepts registrations up to the total of their layout capacities, and refuses the next

## Specification

| Item | Content |
|---|---|
| Test Case ID | R2-T3 |
| Test Scenario | CR-03 (CQ-04): an event with two confirmed venues accepts registrations up to the total of their layout capacities, and refuses the next |
| Pre-conditions | Automated (CI), against the registration schema: an event with two bookings of 2 and 1 seats, as two `venue-booking.request-approved` messages handled by the seat builder. |
| Test Steps | 1. Register three different attendees through `POST /api/v1/registrations`.<br>2. Register a fourth. |
| Test Data | Booking 1: 2 seats · Booking 2: 1 seat · four attendees |
| Expected Result | The first three are registered (`201`), the fourth is refused for capacity (`409`, `REGISTRATION_FULL`). Places remaining is 0, never negative. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Automated test written: backend/services/registration/tests/api/r2Cards.test.ts › R2-T3 accepts registrations up to the total of two venues' capacities, then refuses for capacity (API level); not yet run: CI's integration job stops at planning-core's unrelated L3-T17 date failure (fixed by PR #82) before it reaches the registration step (commit d43fab5). Becomes Pass when that step runs green. |
| Executed By |  |
| Date of Execution |  |
