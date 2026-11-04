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
| Actual Result | FX-R-EVENT (1 seat, taken by another attendee) was made for an event planning-core holds too (Approved), so M1 could confirm it a further venue; Attendee One joined the waitlist. A second venue, whose Theatre layout seats 2, was requested for the event's period. Step 1: Venue Staff approved the request in Booking requests (`<reference> approved. The booking is confirmed.`). The approval was handed to the registration service's seat builder, which built the 2 seats, and the `waitlist.place-opened` it wrote was stored by the notification service (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without). The event's page then showed `2 places remaining`; Attendee One had no registration for the event and the entry stayed WAITLISTED with its last-told time set. Step 2: Attendee One's Notifications read `A place has opened at EVT-… “R Test Symposium …”. Register now if you still want one: places go to whoever registers first.` |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5cd14bb · Evidence: tests/e2e/r-management.spec.ts › R6-T11 a further confirmed venue booking adds places, and the waitlist is told, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41793114951 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
