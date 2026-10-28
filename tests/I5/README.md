# I5 — Record a block with no end (W9-FX-3, decision D-01)

Eight cases, written from the story on 24 Oct 2026, before the code. They use FX-BOOKING
(`tests/L1/README.md`) and I2's blocks (`tests/I2/README.md`).

The customer gave two answers that disagree. Charles was told a block "should not be open-ended"
(W9-41); Bryan was told Venue Staff "can set temporary unavailability with end dates or leave it
open-ended until operational issues are resolved and lifted" (W9-49). By decision D-01 the later
answer counts (`documentation/clarifications.md`). I5 replaces I2's "end date/time … mandatory".

| Acceptance criterion | Cases |
|---|---|
| A block may be created with no end; it stays active until Venue Staff remove it; when an end is given it must still be later than the start | I5-T1, I5-T2, I5-T7 |
| An open-ended block disrupts and flags, as in I2, every confirmed booking, pending request and hold at the venue whose occupied period ends after the block starts | I5-T3, I5-T8 |
| From its start, it refuses new booking requests (I2) and new holds (I4) for any later period | I5-T4 |
| The calendar (I1) and venue search (J1) show the venue as unavailable from the block's start, with no end, labelled as open-ended | I5-T5, I5-T6 |

## What an open-ended block is

A block's period runs from its start to its end, and an open-ended block's runs from its start for
ever. Postgres compares it like any other (`&&` on a `[)` range with no upper bound), so
everything that asks "does a block overlap this period?" (calendar, search, requests, holds,
approvals, I2's review) answers correctly with no special case. It stays until Venue Staff remove
it (I2).

## Existing I2 cards

I2-T2 and I2-T3 say the end is mandatory. I5 supersedes that for the end being left out; an end
that is given and isn't after the start is still refused. Their records are not edited (Done
stories' cards keep their results).
