# R3 — View my own registrations

Seven cases, written from the story on 2 Nov 2026, before the code. The `FX-R-…` statements are in
`tests/R1/README.md`.

| Acceptance criterion | Cases |
|---|---|
| The list shows every registration belonging to the signed-in attendee with event name, date, time, venue location, and registration status (Registered, Withdrawn, or Cancelled) | R3-T1, R3-T6 |
| Registrations belonging to other attendees are never shown, including by direct reference | R3-T2, R3-T3 |
| When an event is cancelled, the attendee's registration is shown as Cancelled | R3-T4 |
| Each entry shows the timestamp of the registration and, where applicable, of the withdrawal | R3-T1, R3-T5 |

R3-T7 is a cross-cutting case specific to this story: staff roles have no registrations to list
through the attendee API.

## Where Cancelled comes from

An event is cancelled in planning-core (F3). Every status change, cancellation included, writes the
event's `event.listing-changed` message, and when the registration service reads one whose status
is Cancelled it marks the event's Registered registrations Cancelled, with the time, and frees
their seats. Withdrawn registrations stay Withdrawn. F3 (PR #71) is merged, and its cancellation
also publishes `event.cancelled`, which the consumer handles the same way. R3-T4 delivers both
messages to the consumer in a test; whichever arrives second changes nothing.
