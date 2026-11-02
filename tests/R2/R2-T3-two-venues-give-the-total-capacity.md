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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
