# ADR-0002: Orchestrated saga with compensation for F4 cancellation

**Status:** Accepted
**Date:** 2026-09-15

## Context

F4 requires that cancelling an event release its venue booking, its equipment reservations, and its
registrations **together, or not at all** — an explicit all-or-nothing acceptance criterion. Under
ADR-0001, venue, equipment, and registration each live in their own service with their own database
schema, so this cannot be a single Postgres transaction: there is no way to atomically commit writes
across three independent databases.

This is a direct consequence of the schema-per-service decision in ADR-0001, not a separate design
choice we were free to avoid — it is the specific place that decision gets expensive, and it is the
weak point most likely to come up in a Week 13 Q&A.

## Decision

**An orchestrated saga, driven by the Event Service, with compensation on failure.** The Event
Service calls each release endpoint (Venue, Equipment, Registration) in turn; every release endpoint
is idempotent, so a retried call after a partial failure is safe. If any release call fails, the
orchestrator compensates the releases that already succeeded, and the cancellation itself is **not**
recorded — F4's all-or-nothing requirement is satisfied at the level of "did the cancellation
happen," even though the underlying releases are not atomic.

This is deliberately narrower than the customer's requirement for S3 (significant changes), which
is flag-and-notify rather than all-or-nothing — evidence that the customer does tolerate asynchrony
where it isn't load-bearing, and that F4's all-or-nothing requirement is a real constraint, not an
assumption we added.

## Alternatives considered

- **Two-phase commit (2PC) across the three services' databases.** Would give real atomicity.
  Rejected: Postgres-to-Postgres 2PC across independently owned schemas is operationally heavy (a
  transaction coordinator, blocking participants, a single point of failure during the commit
  window) for a system with no distributed-transaction infrastructure already in place, and
  contradicts the "no service depends on another's internals" boundary from ADR-0001 by requiring
  all three databases to participate in one coordinated commit protocol.
- **Eventual consistency (publish a "cancel requested" event, let each service release in its own
  time).** Simpler, fits the Kafka-first communication style from ADR-0001. Rejected because F4's
  acceptance criterion is explicitly all-or-nothing, and eventual consistency cannot guarantee that
  — a venue release could succeed while an equipment release silently never completes, leaving the
  event cancelled but equipment still held.
- **Choreographed saga (each service reacts to the previous service's event, no central
  orchestrator).** Would avoid giving the Event Service a special coordinating role. Rejected because
  compensation logic — "if step 3 fails, undo steps 1 and 2, in this order" — is easier to reason
  about, test, and debug when one place owns the sequence, rather than being implicit in a chain of
  event handlers across three services.

## Consequences

**What we get:** F4's all-or-nothing requirement is honoured at the observable level — a
cancellation is either fully applied or not recorded at all — without requiring distributed-
transaction infrastructure we don't have and a system with modest scale doesn't need.

**What it costs us, and what to say if asked:**
- **There is a window during which state is genuinely inconsistent** — e.g. the venue has been
  released but equipment has not yet been called. This is real, not a rounding error, and we are not
  claiming otherwise.
- **Compensation can itself fail.** If a release fails and its compensating call also fails, the
  saga cannot self-heal; this needs a monitoring/alerting story or a manual reconciliation path
  before this system would be production-ready. That is an acknowledged gap, not something this ADR
  claims to solve.
- Every release endpoint (Venue, Equipment, Registration) must be idempotent *and* have a working
  compensating action, in perpetuity — any future change to a release endpoint must keep both
  properties, or F4 silently breaks.

**What a reviewer should watch for:** a release endpoint added without a compensating action, or a
saga step that isn't idempotent (so a retry after a transient failure double-releases or
double-notifies), is the specific way this decision fails in practice.
