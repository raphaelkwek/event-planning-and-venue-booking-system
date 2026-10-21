# H3 — Set a venue's setup and turnaround time (CR-01)

Ten cases, written from the story on 4 Oct 2026, before the code, and four more (H3-T11 to H3-T14) on 21 Oct 2026, before pending requests were flagged. They also cover H1's CR-01
criterion, that the venue record holds both times.

| Acceptance criterion | Cases |
|---|---|
| Whole minutes, 0 or more; any other value is refused and stores nothing | H3-T1 to H3-T5 |
| An event's occupied period runs from start − setup to end + turnaround | H3-T8 |
| Availability, holds, approval, conflicts and blocks compare occupied periods; touching ones don't overlap | H3-T9, and each of I1, I2, J1, L3, M1, N1, N2's own cases |
| A change flags the holds, pending requests and bookings that now overlap, removes none, and notifies their coordinators | H3-T10 (bookings and holds), H3-T11 (a pending request), H3-T12 (requests that already clashed aren't), H3-T13 (times that touch clear it), H3-T14 (removing a block keeps the flag, saying why) |
| Each change records who, when, and previous and new values | H3-T6 |
| Only Venue Staff can change them | H3-T7 |

H3-T1 to H3-T7 ran in Sprint 2. H3-T8 to H3-T10 waited for bookings (EN-02.1, L1, M1, I1) and ran
on 20 Oct 2026, once M1's approval copied the venue's own times into each booking and a change
of times flagged the bookings it makes overlap.

## Preconditions for H3-T8 to H3-T10

The bookings are made through the API, as their pre-conditions say: FX-BOOKING
(`tests/L1/README.md`), then the coordinator requests Lee Kong Chian Auditorium for the period
(L1) and venuestaff approves it (M1). H3-T9's second event and H3-T10's are the N1 second event
statement (`tests/N1/README.md`). For H3-T10 that event is assigned to the other coordinator, so
that each booking has its own coordinator to notify.
