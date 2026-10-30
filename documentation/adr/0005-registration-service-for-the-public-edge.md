# ADR-0005: Split out the public edge as a registration service

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** Yichen (EN-13, SPM-131), who presents this in the Week 13 Q&A.
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

## Implementation notes (EN-13, 30 Oct 2026)

What was decided while building it, where it differs from the text above:

- **Its own database is its own schema.** The team has one hosted Supabase project, so the service owns the `registration` schema and its own migrations folder (`backend/services/registration/migrations`), as notification does. A separate database is a deployment change (EN-10), not a code change.
- **Seats come from `venue-booking.request-approved`, not a `booking.confirmed` message.** No such message existed. The approval message gained two optional fields, `layout` and `layoutCapacity`, filled by the venue module from its own layouts in the approval's transaction. They are optional so approvals published earlier still parse; the registration service builds no seats from one that lacks them, and logs a warning. A reviewed `contracts` change.
- **One approval, one booking's seats.** Seat numbers run from 1 within a booking, so an event with several venues (CQ-04) has the total of its bookings. When an approval replaces a booking (CR-02), the replaced booking's free seats are retired.
- **The VIP pool starts empty.** Every seat is created `PUBLIC`; `setVipSeats` moves free seats. Nothing yet calls it: the organiser's control is R7's.
- **No retry or dead-letter topic yet.** A message that fails validation is logged and skipped. A database failure throws, and the consumer gets the message again. The inbox makes that safe.
- **The attendee PWA shell is not part of this change.** See ADR-0014.

