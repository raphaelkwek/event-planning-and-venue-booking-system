# R6-T11 — When capacity increases (another confirmed venue booking), waitlisted attendees are notified that a place is open

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T11 |
| Test Scenario | When capacity increases (another confirmed venue booking), waitlisted attendees are notified that a place is open |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Kafka configured.<br>2. FX-R-EVENT with `<SEATS>` 1, FX-R-TAKEN with `<N>` = 1; Attendee One joins the waitlist. |
| Test Steps | 1. A second venue booking for the event is approved (M1 with CR-03's several venues), adding 2 seats.<br>2. As Attendee One, open "Notifications". |
| Test Data | 1 seat, then 3 |
| Expected Result | The event shows `2 places remaining`, and Attendee One is told a place has opened. Nobody is registered for them. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r6Cards.test.ts › R6-T11 tells the waitlist when a further confirmed booking adds places, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). Delivery to the Notifications screen needs Kafka. UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
