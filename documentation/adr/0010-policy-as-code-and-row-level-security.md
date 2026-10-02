# ADR-0010: Policy-as-code for actions, row-level security for data

**Status:** Accepted
**Date:** 2026-10-01
**Owner:** whoever takes EN-07 (SPM-125), not yet assigned. The owner presents this in the Week 13 Q&A.
**Approval:** team decision, reported 1 Oct 2026. See the gate log in `documentation/proposals/2026-10-01-target-architecture-and-jira-plan.md` §8.

## Context

**A2** decides which roles may call which function, and its first criterion requires the same list to govern the interface and the server. **A3** decides which rows a user may see: an organiser must never see another organiser's event. A3 is exactly OWASP API1, broken object level authorization.

Today the role list is checked in handlers and the scope is a filter in the repository layer. RLS is bypassed, so one forgotten `WHERE` clause leaks data. A2 and A3 are Done (Sprint 1). This ADR hardens them rather than reopening them.

## Decision

- **A2: actions.** Cerbos policies are kept in the repo. The gateway, each service and the SPA navigation all evaluate the same policy bundle, so the menu and the server can't disagree.
- **A3: data.** Postgres row-level security is enforced. Each request runs as a restricted database role, with the caller's claims set by `SET LOCAL` inside every transaction. That way the claims survive a transaction-mode connection pooler.
- **One generated test matrix** covers every role × every endpoint × related and unrelated resources.

## Alternatives considered

- **Role checks written into each handler (the current design).** They drift from the UI over time. Rejected.
- **OpenFGA-style relationship tuples.** These would have to be synced on every change, when the relationships are already columns on the rows. Rejected.

## Consequences

**What we get:**
- One source of truth for permissions.
- A forgotten filter can't leak another organiser's event, because the database refuses.
- A matrix that shows coverage at a glance.

**What it costs:**
- Two policy languages, Cerbos and SQL policies, which the generated matrix keeps consistent.
- RLS through Supabase's pooler must be proved: claims must be set with `SET LOCAL` inside each transaction. That's an integration test in EN-07.

**What a reviewer should watch for:**
- A role check hard-coded in a handler or component.
- A query run as a role that bypasses RLS.
- A new endpoint with no row in the matrix.

**Implemented by:** EN-07 (SPM-125). **Relates to:** A2 (SPM-12) and A3 (SPM-13).
