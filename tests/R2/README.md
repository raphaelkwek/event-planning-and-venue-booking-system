# R2 — Register for an event

Fourteen cases, written from the story on 2 Nov 2026, before the code. The `FX-R-…` statements
are in `tests/R1/README.md`.

| Acceptance criterion | Cases |
|---|---|
| A successful registration is stored with the attendee, the event, status Registered, and the registration timestamp, and the attendee sees a confirmation | R2-T1 |
| The number of places is derived from the capacity of the booked venue for the booked layout, less any attendees added manually (R7). There is no separately entered registration capacity, and expected attendance does not cap registration | R2-T2, R2-T13 |
| CR-03 (CQ-04): for an event with several venues, the capacity that limits registration is the total of the layout capacities of its confirmed bookings | R2-T3 |
| D-01: manual additions (R7) may take the number of attendees above capacity. Places remaining is then zero, never negative, and a registration is refused for capacity until withdrawals bring the total below capacity | R2-T13 |
| The capacity check and the registration are atomic: when two attendees register simultaneously for the last remaining place, exactly one registration is created | R2-T5 |
| The unsuccessful attempt creates no registration record, leaves places remaining unchanged, returns a message naming capacity as the cause, and offers the attendee a place on the waitlist (R6) | R2-T4 |
| A second registration by the same attendee for the same event is refused, no second record is created, and the message names the existing registration | R2-T6 |
| Registration is accepted within the registration window set by the Event Organiser for that event, from the opening instant up to and including the closing instant, and refused outside it, naming the window as the cause | R2-T7, R2-T8, R2-T9, R2-T10, R2-T11 |
| On success, places remaining decreases by exactly one; on any refusal it is unchanged | R2-T1, R2-T2, R2-T4, R2-T6, R2-T8, R2-T10 |
| The attendee receives a registration confirmation notification | R2-T12 |

R2-T14 is a cross-cutting case specific to this story: only attendees register, and an event that
isn't open is not revealed.

## The window is the organiser's

The opening and closing are the ones the organiser gave on the request (B2), and the organiser can
change them later on the event's "Registration settings" screen (R2-T11) while the event is
Approved, Planning, Safety Review or Confirmed. The same rules apply as at submission: both are
required when registration is, the closing is later than the opening, and no later than the event's
start.

## What isn't built yet

- **The waitlist (R6).** A refusal for capacity says a waitlist place can be offered
  (`details.waitlistOffered: true`), and the event page says so, but joining it arrives with R6.
- **Manual additions (R7).** R2-T13 needs them. The rule that keeps places remaining at zero, never
  negative, is in the registration service's domain (`placesRemaining`) and unit-tested.
