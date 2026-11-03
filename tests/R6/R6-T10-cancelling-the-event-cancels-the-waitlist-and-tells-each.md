# R6-T10 — When the event is cancelled, active waitlist entries become Cancelled and each waitlisted attendee is notified

## Specification

| Item | Content |
|---|---|
| Test Case ID | R6-T10 |
| Test Scenario | When the event is cancelled, active waitlist entries become Cancelled and each waitlisted attendee is notified |
| Pre-conditions | 1. Standard environment running and test data reset (`tests/README.md`), with the registration service running (`npm run dev` starts it). The R fixtures are in `tests/R1/README.md` and `tests/R5/README.md`. Kafka configured.<br>2. FX-R-EVENT with `<SEATS>` 1, FX-R-TAKEN with `<N>` = 1; Attendee One joins the waitlist. |
| Test Steps | 1. The event is cancelled (F3), so the registration service receives F3's `event.cancelled` for it.<br>2. As Attendee One, open "My registrations" and "Notifications". |
| Test Data | 1 waitlisted attendee |
| Expected Result | The waitlist entry reads `Cancelled` with the time. A notification reads `EVT-R… “R Test Symposium” has been cancelled, so your place on its waitlist (WL-…) is cancelled.` An entry already Withdrawn stays Withdrawn and is not told. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Proven at API level by backend/services/registration/tests/api/r6Cards.test.ts › R6-T10 cancels the active waitlist entries with the event and tells each attendee, which passed in CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41523834657 (commit d7abf51). Delivery to the Notifications screen needs Kafka. UI walk-through in Chrome pending at the sprint review. |
| Executed By |  |
| Date of Execution |  |
