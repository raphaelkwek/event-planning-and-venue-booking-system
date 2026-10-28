# I4 — Refuse a hold over a blocked period (W9-FX-2)

Seven cases, written from the story on 24 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`) and the blocks I2 records. The story comes from the customer's Week 9
answer: "Marking a venue unavailable for hold blocks new holds and bookings, and flags affected
existing bookings so alternative venues can be arranged" (`documentation/clarifications.md`,
W9-41).

| Acceptance criterion | Cases |
|---|---|
| Requesting or placing a hold whose occupied period (H3) overlaps an active block is refused; the refusal names the block, its period and its reason type; nothing is stored; periods that merely touch don't overlap | I4-T1 (requesting), I4-T2 (placing), I4-T3 (occupied period), I4-T4 (touching), I4-T7 (another venue) |
| Holds already requested or placed when a block is created are flagged, not refused or released, as in I2 | I4-T5 |
| Once the block is removed, holds over its period can be requested and placed again | I4-T6 |

## What "requested or placed" means for flags

A hold that is only **Requested** reserves nothing and has no slot, so a block has nothing to
disrupt. It stays Requested, and placing it is refused while the block is active (I4-T2, I4-T5).
A **Held** hold owns a slot, and I2 already flags that slot Requires Reconfirmation and tells the
coordinator; I4-T5 checks that this still holds.

## Fixtures

- A block is recorded through I2 (`tests/I2/README.md`), as the cases say.
- Holds are requested and placed through L3's screens: the coordinator's "Request a hold" form, and
  Venue Staff's "Hold requests" page (`tests/L3/README.md`).
- `Lee Kong Chian Auditorium` and `Seminar Room 2-1` are FX-BOOKING's venues.
