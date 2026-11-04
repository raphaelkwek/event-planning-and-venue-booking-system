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
| Actual Result | FX-R-EVENT (1 seat, taken by another attendee) was made for an event planning-core holds too (Approved, `R Test Symposium …`), so F3 could cancel it; the listing carries that event's own EVT-… reference rather than an EVT-R one. Attendee One joined the waitlist; Attendee Two joined and left (Withdrawn). Step 1: the owner cancelled the event on its page (200, `This event was cancelled`). F3's `event.cancelled` was handed to the registration service's consumer, which applied it, and the messages it wrote then reached the notification service, which stored one `waitlist.cancelled` (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without). Attendee One's entry became CANCELLED with its time; Attendee Two's stayed WITHDRAWN with no cancellation or notice time, and the registration outbox held `waitlist.cancelled` for Attendee One only. Step 2: My registrations showed Attendee One's entry as `Cancelled` with `Cancelled <time>, with the event`, and Notifications read `EVT-… “R Test Symposium …” has been cancelled, so your place on its waitlist (WL-…) is cancelled.` Attendee Two's Notifications held no notice about the event. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: c0f7183 · Evidence: tests/e2e/r-management.spec.ts › R6-T10 cancelling the event cancels the waiting entries and tells each attendee; a left entry stays Withdrawn, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41798410254 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
