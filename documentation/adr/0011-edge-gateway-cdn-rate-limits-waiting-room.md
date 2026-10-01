# ADR-0011: Edge: gateway, CDN, rate limits, waiting room

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-12 (SPM-130), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

`plan.md` §3 lists an API gateway, but it was never built: the web app uses a Vite development proxy. Registration opening is the only real traffic spike in this business (briefing 8a and 8e). Without an edge, every service checks tokens its own way and nothing stops a flood of requests.

## Decision

- **Kong** verifies Supabase JWTs against the JWKS, applies token-bucket rate limits per user and per IP, stamps trace context and routes requests. The rate-limit counters live in Redis, so every gateway copy sees the same count.
- **Staff and public traffic** use separate routes and separate upstream pools.
- **A CDN** serves the SPAs. It caches the attendee browse API for 5 seconds with stale-while-revalidate, and registering always re-checks live.
- **A virtual waiting room** handles events flagged high-demand. It admits attendees at the rate the registration service has been measured to sustain (EN-18).

## Alternatives considered

- **Each service verifies tokens and limits itself.** That duplicates the logic, and the copies drift apart. Rejected.
- **No waiting room, only rate limits.** During a rush, people get "try again later" instead of a fair queue. That's acceptable if capacity runs short, so the waiting room is Tier 2 and the first thing to cut.

## Consequences

**What we get:**
- One place for edge policy.
- A bot or a rush can't flood the backend.
- The attendee list loads from the CDN even under load.

**What it costs:**
- Redis and Kong to run.
- The waiting room adds moving parts, and it is only worth having once the measured capacity exists (EN-18).

**What a reviewer should watch for:** a public route reaching a staff upstream, or an endpoint that bypasses the gateway.

**Implemented by:** EN-12 (SPM-130) and EN-19 (SPM-137), both Tier 2.
