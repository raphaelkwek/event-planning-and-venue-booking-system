# N2 — Flag potential conflicts before a decision is made

Nine cases, written from the story on 21 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`), the N1 statements (`tests/N1/README.md`) and the requests L1 raises.

| Acceptance criterion | Cases |
|---|---|
| Each pending request in the queue is flagged when its period overlaps another pending request or a confirmed booking for the same venue | N2-T1, N2-T2, N2-T4 |
| CR-01: periods are compared as occupied periods (H3) | N2-T3, N2-T4 |
| The flag names each conflicting booking reference and its period | N2-T1, N2-T2, N2-T8 |
| The requesting coordinator sees the same flag on their own pending request | N2-T5 |
| The flag is recalculated whenever a booking for that venue is created, approved, rejected, withdrawn, or released | N2-T6 (created), N2-T7 (withdrawn, rejected), N2-T8 (approved, released) |
| The flag is informational: its presence alone neither approves nor rejects any request | N2-T9 |

## The rule

- A pending request's occupied period is its period widened by the venue's setup and turnaround
  time as they stand now: those are the times an approval would copy (H3). A confirmed booking's
  is the one it was made with.
- Two periods conflict when they overlap. Periods that only touch don't.
- A request is compared with the venue's other pending requests and its confirmed bookings. A
  replacement request (L5) isn't compared with the booking it replaces, which its approval
  releases first. Holds are left out: the story names pending requests and confirmed bookings.
- The flag is worked out each time a request is shown, so it is never out of date: whatever
  creates, approves, rejects, withdraws or releases a booking at the venue changes the next read.
  Nothing is stored, and the flag changes no status.
