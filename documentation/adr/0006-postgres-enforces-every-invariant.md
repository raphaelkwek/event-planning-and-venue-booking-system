# ADR-0006: Postgres enforces every invariant

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-02 (SPM-120), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

N1, Q1, R2 and L3 each require that when two actions race, exactly one wins. Checking availability in application memory and then writing can be beaten by timing, and running more pods only makes that more likely.

Checking the design against the stories found three bugs in `implementation.md` §4.6:
- **The equipment counter has no time dimension.** One `total/reserved` row per type can't answer "is it free between 2 and 5 pm on Friday", which P1, P2 and Q1 all need.
- **A block can slip past an in-flight approval.** I2 can create a maintenance block while M1 is approving an overlapping booking, leaving an unflagged booking that overlaps the block.
- **"Requires Reconfirmation" as a status would free the slot.** The exclusion constraint covers only HELD and CONFIRMED, so moving a booking to that status would let someone else take its slot.

## Decision

**Six mechanisms, all in Postgres. Nothing reads availability and then writes.**

| Invariant | Stories | Mechanism |
|---|---|---|
| One hold or booking per venue and period | L3, M1, N1 | Exclusion constraint on `venue_slots` over `blocked_period`, for status HELD or CONFIRMED |
| A block can't slip past an in-flight approval | I2, M1 | Both take `SELECT … FOR UPDATE` on the venue row first |
| Serialized equipment is never double-reserved | Q1 | Per-unit exclusion constraint on `unit_reservations` |
| Bulk equipment is never over-reserved | Q1, P2 | Lock the equipment-type row, then check peak concurrent use in the window |
| Registrations never exceed capacity | R2, R7 | One row per seat, claimed with `FOR UPDATE SKIP LOCKED` (ADR-0005) |
| No lost updates on event edits | G1, S2 | Expected version on the event stream, exposed as HTTP `If-Match` (ADR-0007, ADR-0015) |

Two further rules:
- **`blocked_period`** is `[start − setup, end + turnaround)`, the occupied period. The buffers were zero until the Week 7 change CR-01 made them per-venue settings (H3), a data change, not a redesign.
- **Requires Reconfirmation is a boolean column, never a status.** A flagged booking keeps blocking its slot. A hold that L1 converts into a booking request keeps its slot HELD until M1 or M2 decides.

## Alternatives considered

- **Checks in application code.** They lose races: both requests read "free" and both write. Rejected.
- **`SERIALIZABLE` everywhere.** It needs retry handling on every write and still doesn't cover rules that span services. It's kept only where an invariant truly needs read-before-write and no lock or constraint fits. Rejected as the default.
- **The time-agnostic equipment counter (the current §4.6).** It can't express P1, P2 or Q1 correctly. Rejected.

## Consequences

**What we get:** the guarantee holds however many pods run, so horizontal scaling stays safe. Each guarantee is per aggregate (linearizable per venue slot, unit, type or seat), as `implementation.md` §4.5 already argues.

**What it costs:**
- You need Postgres-specific skills: GiST, row locks, `SKIP LOCKED`.
- **Every mechanism needs a race test.** EN-02's harness fires 50 parallel attempts and checks that exactly one wins.
- How P1 counts availability (peak concurrent use or summed overlaps) waits on CQ-02. The design supports both.

**What a reviewer should watch for:** a `SELECT` followed by an `INSERT` or `UPDATE` on a contended resource, or a status value used where a flag belongs.

**Implemented by:** EN-02 (SPM-120) and EN-13 (SPM-131). **Updates:** `implementation.md` §4.5 to §4.7.

## As built: conflicting inserts need a lock as well (EN-02.3, 6 Oct 2026)

EN-02.3's race harness fires fifty attempts at once, ten rounds each. It found that the exclusion constraints alone let some losers fail the wrong way.
- **What happens:** two conflicting inserts in flight at the same time can each wait for the other on the constraint. Postgres then aborts one as a **deadlock (`40P01`)**, not an overlap (`23P01`).
- **Why it matters:** the user would get a server error instead of N1's or Q1's refusal. The guarantee itself held, because exactly one insert won each time; the refusal didn't.
- **The fix:** every venue slot insert takes the venue row lock, the one M1 and I2 already take. Every equipment reservation takes its type's row lock, the one bulk stock already takes. Contenders queue, and each loser meets a committed winner. The constraints still decide.
- **Cost:** inserts for one venue, or one equipment type, run one at a time. At this system's scale that's milliseconds.

## Week 7 customer changes (2 Oct 2026)

These are recorded in `documentation/change-requests.md`. None of them changes the decision; they use the room it left.

- **CR-01, setup and turnaround:** the exclusion constraint already works on `blocked_period`, which now carries real buffers.
  - Changing a venue's buffers must not rewrite stored periods, because the constraint would reject any new overlap.
  - Instead, compute the would-be periods and flag every booking that now conflicts as Requires Reconfirmation. Nothing is silently removed.
- **CR-03, several venues per event:** `venue_slots` already holds one row per booking, carrying `event_id`. One event simply has several rows, and each venue's slots are constrained independently.
- **CR-04, holds expire:** an expired hold moves to `EXPIRED`. The constraint's `status in ('HELD','CONFIRMED')` filter already frees the period, with no change to the constraint.
