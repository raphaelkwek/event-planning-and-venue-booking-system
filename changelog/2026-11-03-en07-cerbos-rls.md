# EN-07: the Cerbos policies run at request time, RLS backs A3 and A4, and a generated matrix checks both

**Timestamp:** 2026-11-03T20:50+08:00 (SGT)
**Author:** Joash
**Scope:** EN-07 (SPM-125): EN-07.1 (SPM-163), EN-07.2 (SPM-168), EN-07.3 (SPM-173). ADR-0010.
planning-core (`src/shared/authz/`, every module's `auth/actor.ts` and routes, the identity module's
permissions check, the event repo), migration `event/0025`, `policies/`, the staff console's
navigation, CI, the Playwright stack, docs and cards. The 2 Nov audit found EN-07 about a quarter built
(the policies and their tests only); this finishes it.

## What changed

- **Every planning-core route asks the Cerbos PDP** at `CERBOS_URL` (`@cerbos/http`). A route names
  the policy resource and action it performs (`requireRole("event", "approve")`), never a list of roles.
  A role the policy never allows gets `403 ROLE_NOT_AUTHORISED`; an unanswered check (2 s) gets the new
  `503 POLICY_UNAVAILABLE`. It fails closed.
- **The same roles as before.** Before switching, every route was probed with every role on main and
  the policies were aligned to that matrix. Three real disagreements were fixed in the policy: I2's
  unavailability belongs to the venue's own staff, G2's change-impact preview is the owner's too, and
  the owner lists an event's venue requests. Role lists the policies duplicated are gone (each route's
  `requireRole(<roles>)`, GET /users' attendee check, F2's `HISTORY_ROLES`, G2's `PREVIEWERS`).
- **The staff console asks the policies.** `POST /api/v1/permissions/check` answers, for the verified
  caller only, which of the screens' actions their role may take; the navigation and the route guard use
  it, and fail closed if it can't be read. App.tsx holds no role lists.
- **Row-level security (EN-07.2).** Migration `event/0025` enables RLS on `event.events` and
  `event.assignments` for a new `connectsphere_request` role, with policies that state the repo's scope
  rule in SQL. Every scoped read runs as that role with `SET LOCAL ROLE` and the claims `app.user_id` and
  `app.access_scope` set with `set_config(…, true)` inside its transaction, which is safe through
  Supabase's transaction pooler. The service's login role owns the tables and RLS isn't forced, so the
  migrator, the outbox relay, the Temporal worker and the jobs read every row, as they act for the system.
- **The generated matrix (EN-07.3).** `authorisationMatrix.test.ts` takes the routes off the router ×
  the seven roles × a related and an unrelated record, and holds each response to the PDP's own decision
  plus RLS. `routePermissions.unit.test.ts` fails on a route without a gate or an action no policy has.
- **Local and CI.** `npm run cerbos:start` runs the pinned binary on `policies/` (inside WSL on Windows,
  where Cerbos has no build) and `npm run dev` starts it. Where no PDP answers in development (Windows
  without WSL), planning-core evaluates `policies/` itself, with one loud startup warning; production
  (`NODE_ENV=production`) refuses that mode at startup and stays fail-closed. CI's integration job runs the PDP as a service
  container; the Playwright stack runs the binary. Unit runs ask a double that reads the same policies,
  held to the real PDP by `pdpDouble.test.ts`.
- **Merged main** (U1, R1 to R4, EN-10, EN-14, EN-15, EN-17): U1's safety routes and R2's registration
  settings are gated by policy, and the Safety Officer keeps exactly the routes main gave them.

## Not done

- **The gateway (EN-12) isn't built**, so EN-07-T13 is Blocked. It would ask the same PDP.
- **The registration and notification services** still check roles in their own code; only
  planning-core asks the PDP.
- **Two record-level checks stay in domain code**, because they re-check inside a transaction, where no
  HTTP call may run: G1's `mayEditDetails` and R2's `maySetRegistration`.
- **RLS covers the event schema** (events and assignments); booking requests, holds and equipment lines
  are still scoped by query alone.
- **Supabase's real pooler wasn't exercised**: EN-07-T9 proves the property it needs (nothing survives
  the transaction on a reused connection) against the throwaway Postgres.

## Tests and cards

- `tests/EN-07/` (T1 to T13) with a README mapping each criterion; traceability rows in
  `sprint-4.csv`. Cards record Pass only from the CI run named in them.
- Four existing tests changed, each because it asserted the role-list mechanism EN-07 removes, not a
  behaviour: the equipment actor's two `requireRole(<roles>)` cases, F2's `HISTORY_ROLES` cases (moved to
  `historyReaders.unit.test.ts`, now against the policy), and G2's repo-level refusal (now the route's).
