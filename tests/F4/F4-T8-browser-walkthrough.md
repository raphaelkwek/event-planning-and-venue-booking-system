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
| Actual Result | |
| Status | Not Executed |
| Remarks | Steps 1, 2 and the screens of 3 and 4 ran in the browser on CI's throwaway stack: Venue Staff saw the booking on the event's day; the coordinator's Cancel event dialog said the bookings, holds and equipment reservations would be released and the event then showed Cancelled; the venue's day showed no booking for the event and the whole opening day free; Technical Support's line was no longer Reserved and the equipment type's full stock (20) was available for the event's period. The two notices (booking released, equipment released, each with the reason) are not proven: notifications are built from Kafka messages, which CI's stack runs without. Proven by tests/e2e/u-safety-and-assignment.spec.ts › F4-T8 the coordinator cancels an event with a booking and reserved equipment; the venue and the stock are free again, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41694828373 (commit ceb525b). UI walk-through in Chrome pending at the sprint review. |
| Executed By | |
| Date of Execution | |
