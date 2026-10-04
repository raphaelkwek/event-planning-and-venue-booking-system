# H3 — Set a venue's setup and turnaround time (CR-01)

Ten cases, written from the story on 4 Oct 2026, before the code. They also cover H1's CR-01
criterion, that the venue record holds both times.

| Acceptance criterion | Cases |
|---|---|
| Whole minutes, 0 or more; any other value is refused and stores nothing | H3-T1 to H3-T5 |
| An event's occupied period runs from start − setup to end + turnaround | H3-T8 (needs a booking and the calendar) |
| Availability, holds, approval, conflicts and blocks compare occupied periods; touching ones don't overlap | H3-T9 (needs L1, M1), and each of I1, I2, J1, L3, M1, N1, N2's own cases |
| A change flags the bookings that now overlap, removes none, and notifies their coordinators | H3-T10 (needs bookings) |
| Each change records who, when, and previous and new values | H3-T6 |
| Only Venue Staff can change them | H3-T7 |

H3-T8 to H3-T10 are Not Executed because there are no bookings yet: those halves of H3 are built
with EN-02.1, L1 and M1. The occupied-period calculation and the overlap rule are unit-tested now,
and the venue module exports them for those stories.
