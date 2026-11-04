# event-planning-and-venue-booking-system

| Folder | Holds |
|---|---|
| `frontend/` | The web app, one for every role. |
| `backend/` | `planning-core` (the staff-facing modules in one process, ADR-0004), the shared `contracts` package, the migration script and the Supabase CLI config. |
| `documentation/` | Planning (`plan.md`, `implementation.md`), ADRs, proposals, user stories, Superpowers specs and plans, traceability. |
| `tests/` | Functional test cases, one folder per user story. Unit and integration tests live beside their code. |
| `load/`, `chaos/`, `deploy/chaos/` | The k6 load tests and the chaos experiments (EN-18, EN-20). They run in CI only; `documentation/reliability.md` says what they prove and how to run them. |

## Local development

1. `nvm use` (Node 20 — see `.nvmrc`).
2. `npm install` from the repo root.
3. `cp .env.example .env` and fill it in. There is no Docker, and nothing runs locally besides Node (ADR-0003):
   - **Supabase** — from the team's hosted project: the transaction pooler connection string (port 6543) as `DATABASE_URL`, plus `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWKS_URL`.
   - **Kafka** — the shared hosted cluster's bootstrap server and SASL credentials (`KAFKA_*`). No service publishes to Kafka yet, so these can wait until the outbox relay is built.
4. `npm run migrate:all` — applies every module's and service's schema in order (identity, event, venue, equipment, change, notification), plus the identity seed. Already-applied files are skipped, and `npm run migrate -- <module>` still runs one at a time.
5. `npm run seed:auth` — creates matching Supabase Auth users (password: see `backend/services/planning-core/migrations/identity/seed/seed-auth-users.ts`).
6. `npm test` — runs every workspace's test suite (unit and integration) and the script tests. Before you push, also run what CI runs on every pull request: `npm run lint` (ESLint plus the module boundary checks), `npm run typecheck` and `npm run test:unit`, which also checks coverage: domain code must stay at 100%. If the repo sits in OneDrive and Vitest can't clear an old `coverage/` folder (EPERM), delete the folder, or add `-- --coverage.clean=false` when running one workspace.
7. `npm run dev` — starts planning-core on `:8090` and the web app on <http://localhost:5173> in one terminal, each line prefixed with where it came from. The Vite dev server proxies `/identity/*` and `/event/*` to planning-core, so the browser only ever talks to one origin and planning-core needs no CORS. To run just one: `npm run dev -w @connectsphere/planning-core` (or `web`).
8. **Permissions (EN-07).** `npm run dev` also starts the Cerbos policy decision point on `policies/` at `http://127.0.0.1:3592` (`CERBOS_URL`, or alone with `npm run cerbos:start`). Every planning-core route asks it, and the staff console's navigation asks it through `POST /api/v1/permissions/check`; Cerbos has no Windows build, so on Windows it runs the Linux build inside WSL (`wsl --install -d Ubuntu` once). Without WSL, planning-core evaluates `policies/` itself in development and its log says `LOCAL-POLICIES MODE`; production never does, and refuses with `503 POLICY_UNAVAILABLE` without a PDP. See `policies/README.md`.

### Week 12 submission zip

`npm run submission:build -- --deliverables "<folder>" --zip-dir "<folder>"` assembles the seven
numbered folders the course asks for, writes `ConnectSphere.zip` and a `MANIFEST.md` that marks each
part present, placeholder or missing. The backlog comes from `documentation/backlog/jira-export.json`
(refresh with `npm run backlog:export`); the recordings and instructor access are human steps, kept as
placeholders in `documentation/week12-submission/`. Code repository:
<https://github.com/joass1/event-planning-and-venue-booking-system>.

### Deploying

Images, Kubernetes, Terraform, Argo CD and canary releases (EN-10, EN-16, ADR-0012) are in [documentation/deploy.md](documentation/deploy.md). Local development stays as above: no Docker.

How the images are inventoried, scanned and signed (SBOMs, Trivy, cosign, a ZAP baseline scan; EN-21), and how to verify an image yourself, is in [documentation/supply-chain.md](documentation/supply-chain.md).

### Trying the stories in the browser

Sign in at <http://localhost:5173> with any seeded account; the login screen lists them and they all
use the password in `backend/services/planning-core/migrations/identity/seed/seed-auth-users.ts`. What each story looks
like:

| Story | Where |
|---|---|
| A1 | The login screen. Try a wrong password, then `deactivated@connectsphere.test` — the first two refusals read identically, the third does not. Sign out and press Back. |
| A2 | The nav differs by role. The API console proves the server refuses the same action on a direct call, not just that the button was hidden. |
| A3 | An organiser sees only their own requests; the console shows a `404` (not an empty `200`) for someone else's event. |
| B1, B2 | "New request" → Submit. Submitting an almost-empty request names every missing field at once. |
| C1, C2, C3 | Save a request with only a name, reopen it, edit, submit. "My requests" tells drafts from submitted ones and filters to either. |
| D1 | Sign in as the coordinator → "Review queue". Opening a Submitted request moves it to Under Review and records you as reviewer. |
| D2, D3 | Ask for clarification as the coordinator; answer it as the organiser, with a message, an amendment, or both. |
| D4, D5 | Approve, or reject with a reason in the confirmation modal. Neither can be done twice. |

Tests run against a real database: yours is the team's Supabase project, and CI's is a throwaway Postgres built from the migrations on every pull request (EN-06.1). The event suite is not parallelised across files because those files share one database, including the single assignment-cursor row.

### Updating the Confluence sprint log

The changelog is the single point of authorship for "what got done, when" — don't hand-type the
same thing into Confluence a second time. Since 3 Nov 2026 each change adds its own entry file,
`changelog/<YYYY-MM-DD>-<branch-or-slug>.md`, and `CHANGELOG.md` keeps the entries from before that
(implementation.md §11.2). Generate the table from both:

```
npm run changelog                            # the whole log, newest first
npm run confluence:digest                    # every entry, chronological
npm run confluence:digest -- --since 2026-09-16   # only what's new since a date
```

Paste the output straight into the Confluence page as a table. `--out <path>` writes it to a file
instead of stdout; `--order desc` gives the log's own newest-first order if you'd rather read it
that way.

See `documentation/planning/plan.md` for architecture and `documentation/planning/implementation.md` for the mandatory formats every service follows, including the repository layout (§2).

### The event store's tamper check (EN-03)

An event's history is an append-only, hash-chained stream (`event.event_stream`, ADR-0007,
`documentation/planning/implementation.md` §4.9). To check that no entry has been edited or removed:

```sh
npm run event-store:verify
```

It reads the database `DATABASE_URL` names, recomputes every event's hash chain, and checks every
row of the history projection (`event.event_history`) against its stream entry. It prints how much
it checked and exits 0 when everything is intact. Otherwise it exits 1 and names the first broken
link (event, version and why) or the first history row that disagrees. It only reads. CI runs it
after the integration tests, then edits one entry on the runner's throwaway Postgres and checks
that it fails.

### Temporal Cloud (EN-11 branch)

Set `TEMPORAL_ADDRESS` (host:port), `TEMPORAL_NAMESPACE`, `TEMPORAL_API_KEY` and
`TEMPORAL_TASK_QUEUE` in the root `.env`. Validate connectivity without starting
workflows or touching application data:

```sh
npm run temporal:check
# From an isolated worktree, use the main checkout's existing env file:
npm run temporal:check -- ../../../.env
```

This check reads only `TEMPORAL_*` values and never prints credentials. A successful
check proves connection and namespace access, not that a worker is running. The
worker runs as part of this branch's `npm run dev`; it consumes event messages and
can execute completion activities against the configured database.

EN-11 is still incomplete: the history recorder in
`backend/services/planning-core/scripts/record-workflow-histories.ts` needs a local
Temporal test server to capture baseline histories, followed by a replay test wired
into CI. The sandbox used on 20 October refused that server (`EPERM`), and the
read-only Cloud probe timed out. Neither proves the supplied credentials invalid.
CancelEvent is also outstanding against the broader Jira acceptance criteria.
