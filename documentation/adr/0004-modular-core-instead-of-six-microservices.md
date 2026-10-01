# ADR-0004: A modular core instead of six microservices

**Status:** Accepted. Amends ADR-0001.
**Date:** 2026-10-01
**Owner:** whoever takes EN-01 (SPM-119), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

ADR-0001 split the system into six services with one schema each, drawing boundaries around transactional invariants. Several stories need more than one of those services to agree in a single step:

- **F4:** cancelling an event releases its venue booking, equipment reservations and registrations together or not at all.
- **F5:** an event may reach Confirmed only when its venue booking and equipment reservations are both ready, read at the same moment.
- **S2 and S3:** approving a significant change and flagging the arrangements it affects.
- **G2:** warning which arrangements a change would affect means reading bookings, reservations and registrations together.

Under ADR-0001, each of these became an HTTP fan-out or a saga with a window where things are half done (ADR-0002). `implementation.md` §4.7 had to admit that F1's Confirmed transition "cannot be made serializable at all", and in the same breath asked us to re-verify across services inside a transaction, which §4.7 also forbids.

The customer's scale is about 500 internal staff. None of the staff-facing parts needs to deploy or scale on its own. By the end of Sprint 1 only two services existed (Identity and Event), so changing course costs least now.

## Decision

**One deployable, `planning-core`, holds five modules: Identity, Event, Venue, Equipment, and Change and readiness.**

- Each module owns its own Postgres schema, its own migrations and a public TypeScript interface, which is the only file other modules may import.
- CI enforces the boundaries. dependency-cruiser fails the build on imports of another module's internals, and a SQL check rejects queries that touch another module's schema outside that module's repository.
- Rules that span modules (F4, F5, S2 and S3, G2) run as **one Postgres transaction** inside the core.
- Registration and Notification stay separate deployables (ADR-0005, ADR-0008), because their traffic and failure profiles differ from staff work.

**Kept from ADR-0001:**
- CP over AP: refuse rather than guess.
- One schema per owner.
- Invariants enforced by the database.
- The transactional outbox for every domain event.
- No read-then-write on a contended resource.

**Changed from ADR-0001:**
- Identity, Event, Venue and Equipment are modules in one process, not separate services.
- Reads between modules go through the public interface as function calls, not HTTP.
- The synchronous HTTP allowlist in `plan.md` §5 shrinks to calls between the core and the two edge services.

## Alternatives considered

- **Six microservices, as in ADR-0001.** Every cross-module rule becomes a saga, and four more services have to be built and run. Rejected.
- **A single-schema monolith.** It's the simplest option, but coupling grows with nothing to stop it, and the ownership boundaries ADR-0001 exists for are lost. Rejected.

## Consequences

**What we get:**
- F4, F5, S2/S3 and G2 become exact single-transaction operations, and the `implementation.md` §4.7 contradiction disappears.
- There are fewer moving parts to build in Sprints 2 to 4.
- Maintainability (briefing 8g) comes from module boundaries that CI enforces, not from network hops.

**What it costs:**
- Modules can't be released separately, so a bad release affects every staff function. Canary releases with automatic rollback (ADR-0012, EN-16) contain this.
- The boundaries are only as strong as the CI checks, so EN-01 must land with them, not after.
- Each team member still owns a module end to end (folder, schema, tests), but no longer a separate process.

**What a reviewer should watch for:** an import of another module's internals, SQL against another module's schema, or a new HTTP call between two modules that both live in the core. Each violates this ADR.

**Implemented by:** EN-01 (SPM-119). **Related:** ADR-0001 (amended), ADR-0002 (superseded by ADR-0009).
