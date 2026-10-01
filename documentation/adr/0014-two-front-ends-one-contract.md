# ADR-0014: Two front ends, one contract

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-14 (SPM-132), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

The internal roles need a dense Atlaskit console. Attendees need a public, mobile-first surface: the briefing's section 7 requires mobile access. `implementation.md` §7 already separates the two, and R1 moving to Sprint 4 puts the attendee shell inside EN-13.

The briefing (8d) also says users must never see contradictory information. A1 says the back button must show no event data after logout.

## Decision

- **The staff console** uses Atlaskit.
- **The attendee app** is an installable, mobile-first PWA, and "My registrations" stays readable offline.
- **Shared between them:** a design-token package and a typed API client generated from the OpenAPI spec (ADR-0015).
- **Server state** lives in TanStack Query. Server-sent events invalidate stale screens.
- **On logout**, the query cache is cleared, and APIs send `Cache-Control: no-store`.
- **Testing:** every pull request's preview runs Playwright journeys, axe accessibility checks and visual snapshots at 360, 768 and 1280 px (EN-14).

## Alternatives considered

- **One SPA for every role.** It would force one design language on two very different audiences. Rejected.
- **Hand-written API clients.** They drift from the server. Rejected in favour of generated ones.

## Consequences

**What we get:**
- Each audience gets the right interface, without contradictory screens.
- A1's back-button rule is guaranteed rather than hoped for.
- UI regressions are caught before merge.

**What it costs:**
- Two apps to keep visually consistent, which the shared tokens handle.
- Preview environments to run.

**What a reviewer should watch for:**
- A screen that caches server data outside TanStack Query.
- An API response missing `no-store`.
- A hand-edited generated client.

**Implemented by:** EN-14 (SPM-132), with the attendee shell in EN-13 (SPM-131).
