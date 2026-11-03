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

## Implementation notes

**EN-07.1, 2 Oct 2026: the policy decision point runs as the standalone Cerbos binary,** not the embedded one.

- Embedded evaluation needs policy bundles built by Cerbos Hub, a hosted service. The binary works offline and needs no Docker.
- `backend/scripts/cerbos.ts` downloads a pinned release and verifies its SHA-256. `npm run policies:test` compiles the policies and runs their tests, and CI runs it on every pull request.
- Cerbos publishes no Windows build, so Windows users run the policy tests through CI or WSL.
- The policies and the A2 mapping are in `policies/`. Cerbos decides who; each module's domain code decides when.

**EN-07, 3 Nov 2026: the policies run at request time, and RLS backs A3 and A4.**

- **Runtime PDP.** planning-core asks a Cerbos PDP at `CERBOS_URL` (`@cerbos/http`) on every protected
  route. It fails closed: an unanswered check is `503 POLICY_UNAVAILABLE`.
- **Locally**, option (a): `npm run cerbos:start` runs the pinned binary on `policies/` (SHA-256
  checked), and `npm run dev` starts it. Cerbos still publishes no Windows build, so on Windows the
  script runs the Linux build inside WSL when a Linux distribution is installed. Option (b),
  `@cerbos/embedded`, was ruled out: its bundles are built only by Cerbos Hub.
- **Development without a PDP.** When `NODE_ENV` isn't production and no PDP answers at
  `CERBOS_URL`, planning-core evaluates `policies/` itself (local-policies mode, one loud startup
  warning), so `npm run dev` works on Windows without WSL. The evaluator is the unit runs' stand-in, held
  to the real PDP in CI. Production refuses it at startup and stays fail-closed.
- **In CI** the integration job runs the PDP as a service container (`ghcr.io/cerbos/cerbos:0.56.0`), and
  the Playwright stack runs the binary. Each Kubernetes namespace gets its own PDP (EN-10).
- **The staff console** asks `POST /api/v1/permissions/check`, which asks the PDP for the verified
  caller. It does not use `@cerbos/http` in the browser: that client speaks the PDP's own API and sends a
  principal of the browser's choosing, which the server would have to replace anyway.
- **Role lists the policies duplicated were removed** (each route's `requireRole(<roles>)`, GET /users'
  attendee check, F2's `HISTORY_ROLES`, G2's `PREVIEWERS`). Before the switch, every route was probed
  with every role, and the policies were aligned to that matrix, so each route admits the same roles.
  Three disagreements surfaced and were fixed in the policy: I2's unavailability is the venue's own
  staff's (`venue_manager`), G2's preview is the owner's too, and the owner lists an event's venue
  requests (`booking_request list`).
- **RLS** (migration `event/0025`): `event.events` and `event.assignments` for the role
  `connectsphere_request`, with policies that state the repo's `scopeCondition` in SQL. The claims are
  the caller's id and the scope rule the repo applies (not the role), because modules deliberately read
  an event under scope ALL for a record they authorise themselves (Venue Staff's booking, Technical
  Support's equipment line), and RLS must agree with that.
- **The generated matrix** (`tests/api/authorisationMatrix.test.ts`) is EN-07.3.

**Week 7 customer changes, 2 Oct 2026** (`documentation/change-requests.md`):
- **Two new roles:** CR-05 adds `EVENT_COORDINATOR_LEAD` and CR-06 adds `SAFETY_OFFICER`.
  - Both go into contracts `ROLES` and the Cerbos policies. The role-name test fails until every role has a permission.
- **Coordinator scope narrows (A4):** a coordinator acts only on assigned events, and the Lead sees all. This changes `resolveAccessScope` and the RLS policies in EN-07.2.
