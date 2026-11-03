# R3-T4 — When an event is cancelled, the attendee's registration is shown as Cancelled

## Specification

| Item | Content |
|---|---|
| Test Case ID | R3-T4 |
| Test Scenario | When an event is cancelled, the attendee's registration is shown as Cancelled |
| Pre-conditions | Automated (CI), against the registration schema: an attendee registered for an event, then the event's `event.listing-changed` message with status `CANCELLED` handled by the registration service's consumer. With F3 merged, the same message is written when the organiser cancels the event. |
| Test Steps | 1. Register for the event.<br>2. Deliver the cancellation message.<br>3. List the attendee's registrations. |
| Test Data | One registration; the event cancelled after it |
| Expected Result | The registration's status is `CANCELLED`, with the time it was cancelled, and the row is kept. Its seat is free again. In the web app, "My registrations" shows it with a `Cancelled` lozenge and no "Withdraw" button. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the cancellation message, the registration was CANCELLED with cancelledAt 2026-12-06T03:00:00.000Z and kept; a withdrawn one stayed WITHDRAWN; every seat was retired; one registration.cancelled message named the attendee; the event was no longer listed and registering was 404. A redelivery changed nothing. "R3-T4 F3's event.cancelled does the same, and whichever of the two messages comes second changes nothing" also passed. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 4f9ab08 · Evidence: backend/services/registration/tests/api/r3Cards.test.ts › R3-T4 shows the registration as Cancelled when the event is cancelled (event.listing-changed), keeping it and freeing nothing for others, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41602701323 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
