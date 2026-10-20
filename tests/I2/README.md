# I2 — Record a period of venue unavailability

Thirteen cases, written from the story on 19 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`), M1's approval to make a confirmed booking, and the M1 booking statement
(`tests/M1/README.md`) for another event's booking with setup and turnaround.

| Acceptance criterion | Cases |
|---|---|
| A block records venue, start, end, reason type (CR-02's five) and description, all mandatory | I2-T1, I2-T2 |
| The end must be later than the start; otherwise no block is created and the message says why | I2-T3 |
| A block overlapping a confirmed booking is created; before confirming, Venue Staff see each booking it would disrupt, with booking reference, event reference and overlapping period | I2-T4, I2-T6 |
| CR-01: a booking's period is its occupied period, setup and turnaround included | I2-T5 |
| Each disrupted booking is set to Requires Reconfirmation, recording the blocking reason, the acting Venue Staff member and the time | I2-T6 |
| The block doesn't cancel or release the booking; the venue stays booked and the event is unchanged; resolution is L5 or S1/S2 | I2-T7 |
| CR-02: the disrupted event's assigned coordinator is notified, with venue, booking reference, event reference, period and reason, and that alternative arrangements are required | I2-T8 |
| Pending requests and holds overlapping the block are flagged the same way, and the requesting coordinator notified | I2-T9 |
| A block makes the venue unavailable on the calendar and in search, so no new request can be raised for the period | I2-T10 |
| Creating and removing a block record who and when; removing restores availability, clears the flag on bookings disrupted only by that block, and notifies the coordinators | I2-T1, I2-T11 |
| A failed creation changes no availability, flags nothing and notifies no one | I2-T12 |

I2-T13 checks that only the venue's own Venue Staff can record or remove its blocks.

**Holds** belong to L3, which isn't built, so no case can make one through the system. The
integration tests flag a held slot the same way as a confirmed booking.

**How a block meets bookings.** Recording a block takes the venue's row lock first, as M1's approval
does (implementation.md §4.6, rule 1), so a block and an approval at one venue never interleave.
A block's own period is compared with each booking's occupied period, with `&&`; periods that only
touch don't overlap. Whether setup and turnaround also widen the block (CQ-09) is still open.

**Which block flagged what** is kept in `venue.block_disruptions`, one row per block and booking,
hold or request. Removing a block clears a flag only when no other active block still disrupts
that booking.
