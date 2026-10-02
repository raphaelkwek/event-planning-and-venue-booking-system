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
- **`blocked_period`** is `[start − setup, end + teardown)`. The buffers are zero in Release 1 (setup and turnaround are out of scope), and they can be switched on later with data instead of a redesign.
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
