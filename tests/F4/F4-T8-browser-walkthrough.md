# F4-T8 — Browser walkthrough: a cancelled event's venue and equipment are free again

## Specification

| Item | Content |
|---|---|
| Test Case ID | F4-T8 |
| Test Scenario | Signed in for real, the coordinator cancels an event with a booking and reserved equipment; Venue Staff and Technical Support then see both freed. Manual |
| Pre-conditions | 1. The app runs against the team's database with F3's migrations applied, as in `tests/README.md`.<br>2. FX-F4 at browser level from `tests/F4/README.md`. |
| Test Steps | 1. Sign in as `venuestaff@connectsphere.test` and open the venue's availability for the event's day; note the booking.<br>2. Sign in as `coordinator@connectsphere.test`, open the event and select **Cancel event**; read the dialog, enter `Venue flooded.` and confirm.<br>3. As `venuestaff@connectsphere.test`, reopen the venue's availability for that day, and open Notifications.<br>4. As `techsupport@connectsphere.test`, open the reserved line and the equipment type's availability for the event's period, and open Notifications. |
| Test Data | Reason `Venue flooded.` |
| Expected Result | Step 2: the dialog says the bookings, holds, pending requests and reservations will be released; the event shows Cancelled. Step 3: the period shows no booking for the event; one notice names the booking as released, with the reason. Step 4: the line is no longer Reserved and the full stock is available for the period; one notice says the equipment reserved was released, with the reason. |
| Created By | Raphael |
| Date of Creation | 2026-10-29 |

> **Expected results are checked by the PR reviewer** against F4's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | Step 1: Venue Staff saw the event's booking, Confirmed, on its day. Step 2: the coordinator's Cancel event dialog said the venue bookings and holds and the equipment reservations would be released; with `Venue flooded.` the event showed Cancelled. The cancellation's `event.cancelled` was stored by the notification service (the notification was delivered by the test harness (deliverOutbox, the consumers' own code) in place of Kafka, which CI's stack runs without). Step 3: the venue's day showed no booking for the event and the whole opening day free (08:00–22:00); Venue Staff's Notifications held one notice about the event: `EVT-… “…” has been cancelled. Reason: Venue flooded. Released: booking <reference> at <venue>, Tuesday 2 March 2027, 14:00–18:00.` Step 4: Technical Support's line was no longer Reserved, the equipment type's full stock (20) was available for the period, and their Notifications held one notice: `EVT-… “…” has been cancelled. Reason: Venue flooded. The equipment you reserved has been released: <type> × 5.` Run on CI's throwaway stack, with the event on 2 March 2027. |
| Status | Pass |
| Remarks | Automated (browser, Playwright) · Commit: 5bfb25e · Evidence: tests/e2e/u-safety-and-assignment.spec.ts › F4-T8 the coordinator cancels an event with a booking and reserved equipment; the venue and the stock are free again, and their staff are told, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41801285931 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
