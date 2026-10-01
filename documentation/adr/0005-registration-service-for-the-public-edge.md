# ADR-0005: Split out the public edge as a registration service

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-13 (SPM-131), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

Attendee traffic is public and arrives in bursts when registration opens. It also needs different availability from staff work: browsing should keep working while staff systems are down (briefing 8a and 8e).

R2 requires the capacity check and the registration to happen atomically. The current design (`implementation.md` §4.6) reads the ceiling synchronously from the Venue service and then increments one counter row. That puts an HTTP call on every registration and funnels a spike through a single hot row.

R2 and R7 also contradict each other (CQ-01). R7 allows a VIP add "even when no registration places remain" but refuses anything above capacity, while R2 defines places as capacity minus VIP adds.

## Decision

**Registration runs as its own service with its own database.**

- Its seat inventory is built from `booking.confirmed` events. Each event gets one row per seat, and a registration claims any free row with `FOR UPDATE SKIP LOCKED`.
- Seats sit in a **public** pool and a **VIP** pool. The organiser sets the size of the VIP pool. This supports either answer to CQ-01.
- Capacity reductions go through a workflow that shrinks seats before the venue change commits (ADR-0009).
- The attendee app is a separate PWA (ADR-0014).

## Alternatives considered

- **Keep registration inside the core (ADR-0004).** Simpler, but it ties the public spike to staff operations and to the core's connection pool. Rejected.
- **One counter row with a live ceiling from Venue (the current §4.6).** Every request queues behind one row, and every registration depends on Venue being reachable. Rejected.

## Consequences

**What we get:**
- A surge can't use up the core's connection pool. This is a bulkhead.
- Seat counts are exact no matter how many pods run, because capacity equals the number of rows.
- Racing attendees lock different rows instead of queueing.

**What it costs:**
- Cancellation now crosses two deployables. ADR-0009's semantic lock keeps F4 all-or-nothing anyway.
- The seat inventory depends on receiving `booking.confirmed`. Missed messages are covered by the inbox and replay (ADR-0008).

**What a reviewer should watch for:** a registration path that reads capacity and then writes, or any read of a cached ceiling on the write path.

**Implemented by:** EN-13 (SPM-131). Proved by EN-18 (load tests) and EN-20 (chaos experiment 6).
