# L4 — Book several venues for one event (CR-03)

Eleven cases, written from the story on 21 Oct 2026. Most of L4 was built by the stories it
revises: L1 records each request's own layout and attendance and allows requests for different
venues, L3 allows one live hold per venue, K2, N1, N2, M1 and M2 work per venue, L5 lists the
event's bookings, and F5 reads every arrangement. These cases test that, end to end, for one event
using several venues. The one piece L4 adds is the venue module's release of all of an event's
arrangements, for F4's cancellation.

| Acceptance criterion | Cases |
|---|---|
| An event can have requests, holds and confirmed bookings for several venues at the same time, each recorded against the same event | L4-T1, L4-T5 |
| Each venue is checked on its own: suitability (K1), availability and conflicts (N1, N2), and approval or rejection by its own Venue Staff (M1, M2) | L4-T2, L4-T3, L4-T4 |
| The event shows all its venue arrangements together, each with its venue, period, status and booking reference | L4-T5 |
| Withdrawing, rejecting, releasing or changing one arrangement leaves the others unchanged | L4-T6, L4-T7, L4-T8 |
| Cancelling the event (F3, F4) releases all of its venue arrangements | L4-T9 (Not executable: F3, F4) |
| Confirmation (F5) and registration capacity (R2, R7) take every venue into account (CQ-05, CQ-04) | L4-T10; L4-T11 (Not executable: R2, R7, CQ-04) |

**Not executable yet.**
- L4-T9 needs F3 and F4, which cancel an event. The venue half is built and integration-tested:
  `releaseVenueArrangementsForEvent`, exported from the venue module, releases every booking and
  hold of the event and withdraws its pending requests, in F4's transaction.
- L4-T11 needs registration (R2, R7) and the customer's answer to CQ-04.

**CQ-05 is open.** L4-T10 follows F5 as written: every active booking must be confirmed, and at
least one.

## Fixtures

FX-BOOKING (`tests/L1/README.md`) gives the venues: `Lee Kong Chian Auditorium` (Theatre 300) and
`Seminar Room 2-1` (Classroom 60), both looked after by `venuestaff@`, and `Mochtar Riady Hall`
(Theatre 500), which isn't. Bookings are made through L1 and M1. The N1 statements
(`tests/N1/README.md`) give another event's booking, and the release that L5's replacement and F4
perform.
