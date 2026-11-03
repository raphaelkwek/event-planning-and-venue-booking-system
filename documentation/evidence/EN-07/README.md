# EN-07 evidence: Cerbos at runtime, row-level security, and the generated matrix

**Author:** Joash · **Jira:** EN-07 (SPM-125), EN-07.1 (SPM-163), EN-07.2 (SPM-168), EN-07.3 (SPM-173) ·
**Decision:** ADR-0010 · **Cards:** `tests/EN-07/`

**CI run:** [41640443625](https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625)
on `7f1c8fa`. Every job passed: lint, typecheck, build and unit tests (with the Cerbos policy tests),
the integration tests (throwaway Postgres and a Cerbos service container: 2,229 planning-core tests),
the browser tests on the ephemeral stack (now with a PDP), mutation testing, squawk, gitleaks,
observability and the traceability matrix.

## How to run it

| What | Command | Where it runs |
|---|---|---|
| The policies and their tests | `npm run policies:test` | Linux, macOS, WSL; CI on every pull request |
| A local PDP on `policies/` | `npm run cerbos:start` (and `npm run dev` starts it) | at `http://127.0.0.1:3592`, `CERBOS_URL`; Linux, macOS, or WSL on Windows |
| Unit tests, including the route table (EN-07-T12) | `npm run test:unit` | anywhere; a policy double stands in for the PDP |
| RLS, the PDP double against the real PDP, and the matrix | `npm run test:coverage -w @connectsphere/planning-core` | a throwaway Postgres built with `npm run migrate:all`, and `CERBOS_URL` pointing at a PDP (CI's integration job) |

The matrix writes a route × role table to the job summary of each CI run that has `GITHUB_STEP_SUMMARY`.

## The two PDP modes

| Mode | When | What happens without a PDP |
|---|---|---|
| **cerbos** | `NODE_ENV=production` (the images, the Kubernetes deploy), CI, and any development machine where a PDP answers at `CERBOS_URL` | every protected request is refused with `503 POLICY_UNAVAILABLE` |
| **local-policies** | development only: `NODE_ENV` isn't production and no PDP answers at `CERBOS_URL` within 5 s, or it's unset | planning-core evaluates `policies/` itself and logs `=== PERMISSIONS: LOCAL-POLICIES MODE (development only) ===` once at startup |

The local-policies evaluator (`src/shared/authz/localPolicies.ts`) is the one the unit runs use, and
`pdpDouble.test.ts` holds it to the real PDP for every role, kind and action in CI. It cannot run in
production: `startup.ts` asserts the mode before the server listens, and the evaluator throws if it
is constructed with `NODE_ENV=production` (`pdpStartup.unit.test.ts`).

**Checked on Windows without WSL** (this machine, 3 Nov 2026): `npm run cerbos:start` printed that
there is no Windows build and exited 0, so the rest of the dev stack kept running. planning-core,
started alongside it with no `.env` (its settings came from the shell, and the database pointed at
nothing), logged the LOCAL-POLICIES warning after 5 s, listened, and answered `/healthz` 200 and an
unauthenticated permissions check 401. The full `npm run dev` wasn't run, because it reads a `.env`,
and none may be created here.

## What was validated

- **Every existing integration test passes against the real PDP.** Each route asks Cerbos, so a
  policy that admitted a different role than the old role list would have failed the route's own tests.
  Before switching, every route on main was probed with every role, and the gate's answers were
  compared with that probe (and again for the Safety Officer after U1 merged).
- **The PDP double equals the real PDP** for every role, kind and action, on a related and an
  unrelated record (`pdpDouble.test.ts`).
- **RLS** (EN-07-T6 to T10): a query with no WHERE clause returns only the caller's rows, a reassignment
  moves a coordinator's rows at once, missing claims see nothing, the request role can lock but not
  change a row, the claims don't outlive their transaction on a reused connection, and the login role
  the migrator, relay and worker use reads every row.
- **The matrix** (EN-07-T11): every gated and session route × seven roles × a related and an
  unrelated record, more than 800 cases, each matching the PDP's decision plus RLS, with no mismatch.
- **Fail closed** (EN-07-T3): with the PDP unreachable, POST and GET /api/v1/venues answer 503 and the
  database is never touched.

## What was not run

- **The gateway (EN-12)** doesn't exist, so EN-07-T13 is Blocked.
- **The Windows WSL path** of `backend/scripts/cerbos.ts`: the machine that built this has no Linux
  WSL distribution. Without one, the script prints how to install it and exits 0, and planning-core
  uses the local-policies mode (checked, above).
- **Supabase's transaction pooler.** EN-07-T9 proves the property it relies on against the throwaway
  Postgres. Migration `event/0025` has not been applied to the team's shared database.
- **A UI walk-through** of EN-07-T4 in Chrome: the screen tests and the browser tests pass, and the
  walk-through is at the sprint review.
