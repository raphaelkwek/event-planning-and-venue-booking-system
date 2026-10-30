# I6 — Flag buffer-change overlaps on the availability calendar (W9-FX-4)

Five cases, written from the story on 24 Oct 2026, before the code. The customer's Week 9 answer:
"Venue Staff see identified conflicts upon setting buffers, the calendar flags overlapping periods,
and affected Coordinators receive notifications" (W9-46, `documentation/clarifications.md`). H3
already shows Venue Staff the conflicts and notifies the coordinators; I6 adds the calendar's flag.

| Acceptance criterion | Cases |
|---|---|
| Each confirmed booking, hold and pending request flagged by a change of setup or turnaround time (H3) is shown flagged, distinguishable from unflagged arrangements, and names the arrangement it overlaps | I6-T1 (bookings), I6-T2 (a hold and a request), I6-T3 (one not flagged) |
| When the flag is cleared, the calendar no longer shows it the next time it is loaded | I6-T4 |
| Every internal user who can see the calendar sees the flag; attendees still have no access | I6-T5 |

## FX-OVERLAP

1. **FX-BOOKING** (`tests/L1/README.md`). Its event is `<EVT-1>`; note its assigned coordinator.
2. **The N1 second event statement** (`tests/N1/README.md`), assigned to the other seeded
   coordinator. It is `<EVT-2>`.
3. Each coordinator requests `Lee Kong Chian Auditorium`, Theatre, for their event on 2 December
   2026: `<EVT-1>` 10:00–12:00, `<EVT-2>` 12:15–14:00 (L1). As `venuestaff@connectsphere.test`,
   approve both (M1). Note the bookings' references, `<REF-1>` and `<REF-2>`.
4. As `venuestaff@connectsphere.test`, edit `Lee Kong Chian Auditorium`, set the turnaround time to
   `30` minutes and save (H3). The two bookings now overlap: 12:00 plus 30 minutes is past 12:15.

## How the flag reads

On the calendar a flagged booking, hold or request reads "Requires reconfirmation: overlaps
`<REF>` (`<EVT>`) with the venue's setup and turnaround time", with each overlapping arrangement's
reference and its event's reference, so it can be found on the same calendar. Only H3's flag is
shown this way; a block (I2) is its own row on the calendar.
