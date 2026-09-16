# ADR-0001: Microservices with schema-per-service boundaries, CP over AP

**Status:** Accepted
**Date:** 2026-09-15

## Context

ConnectSphere manages the lifecycle of a venue-booked event across five roles (Organiser,
Coordinator, Venue Staff, Tech Support, Attendee), 20 features, 54 stories. Six team members each
need a piece of the system they can own end-to-end, build, test, and defend independently, without
constantly blocking on each other's schema changes.

The domain also carries hard invariants that must never be violated: a venue slot can have at most
one active hold or booking; equipment must never be over-reserved; registrations must never exceed
the booked venue's capacity; an event may reach Confirmed only when both venue and equipment are
ready.

The customer's stated scale is modest — roughly 500 internal staff. That figure does not, on its
own, justify microservices; a well-indexed monolith would handle that load without difficulty. The
decision below is not a scale decision.

## Decision

**Microservices, one Postgres schema per service, no cross-schema joins or foreign keys.**
Boundaries are drawn around *transactional invariants*, not around UI screens or team headcount:
Identity, Event, Venue, Equipment, Registration, and Notification each own exactly one schema and
are the only writer to it. A service reads another service's data through its API, or through a
Kafka-fed projection — never by querying its tables directly. Cross-service references (e.g.
`venue.booking_requests.event_id`) are plain UUIDs with no foreign key; referential integrity
across services is the application's responsibility, not the database's.

**CP over AP.** On a partition or a dependency timeout, a service refuses the operation and returns
an error rather than serving a stale answer or accepting a write it cannot verify. A refusal is a
correct, expected outcome; a double-booking is not.

**Communication is asynchronous (Kafka) by default.** Every domain event is published through a
transactional outbox in the same database transaction as the state change it describes. Synchronous
HTTP between services is permitted only for the short, explicitly enumerated list in `plan.md` §5
(e.g. Event → Venue/Equipment readiness checks, Registration → Venue capacity ceiling, any service →
Identity for role/scope resolution) — never as a general-purpose pattern, never chained more than
two hops deep, and never from inside a database transaction.

Each of the invariants above is owned by exactly one service and enforced by the database itself —
an `EXCLUDE USING gist` constraint for venue slot exclusivity, a conditional `UPDATE ... WHERE
available >= qty` for equipment and registration counts — not by application-level locking or
read-then-write logic.

## Alternatives considered

- **Modular monolith, single schema.** Would have satisfied the actual scale requirement and
  removed the distributed-transaction and eventual-consistency problems entirely. Rejected because
  it does not give each team member an independently ownable, independently deployable, independently
  testable unit — which is what the module boundaries in this project are actually for. This is the
  honest trade we are making, and the one we expect to be asked to defend.
- **Shared database, service-owned tables (schema-per-service without the "no cross-schema query"
  rule).** Would have made cross-service reads cheaper (a join instead of an HTTP call or a
  projection). Rejected because it would let one service's query patterns silently depend on
  another service's internal table shape, reintroducing coupling through the back door — the same
  failure mode schema-per-service exists to prevent.
- **AP with eventual consistency everywhere.** Simpler to build (no synchronous cross-service calls,
  no readiness-check chain), but incompatible with hard invariants like "never double-book a venue
  slot" or "never exceed booked capacity" — those are correctness requirements, not eventually-
  consistent projections. CP was chosen because a temporarily-unavailable booking flow is acceptable
  and a double-booked venue is not.

## Consequences

**What we get:** each service is independently buildable, testable (own test suite, own database),
and defensible in isolation; the invariants that matter most are enforced by the database, which is
stronger than any amount of application-level checking; the six-person team maps cleanly onto six
service owners with clear accountability (`implementation.md` §11, point 10).

**What it costs us:**
- Every cross-service read that used to be a join is now an HTTP call or a Kafka projection — more
  network hops, more failure modes to handle (see the synchronous-call allowlist in `plan.md` §5 and
  the "refuse, don't guess" rule under CP).
- Referential integrity across service boundaries is enforced by us, not Postgres. A dangling
  `event_id` in `venue.booking_requests` is possible if we get this wrong.
- The consistency guarantee we can actually offer is **linearizability per aggregate** (each venue
  slot, equipment type, or registration counter behaves as if its own operations happened one at a
  time), not strict serializability across the whole system. See `implementation.md` §4.5 for why
  that is the right bar and not a shortfall.
- F4 (cancellation releasing venue, equipment, and registration together) is a transaction across
  three services that Postgres cannot give us for free — covered separately in ADR-0002, because it
  is the sharpest edge of this decision and deserves its own record.

**What a reviewer should watch for:** any PR that adds a cross-schema query, a synchronous call not
on the `plan.md` §5 allowlist, or a synchronous chain longer than two hops is violating this ADR,
not making a reasonable local optimisation. Flag it in review.
