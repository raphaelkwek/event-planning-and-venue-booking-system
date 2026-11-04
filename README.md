# event-planning-and-venue-booking-system

ConnectSphere: event requests, venue and equipment booking, safety review and attendee registration for a university campus. An IS212 project by a six-person team at Singapore Management University.

## For the instructors: where to find each part

The quickest way to see the system is the **staging site**, <https://connectsphere-staging.vercel.app>. It holds demonstration data, and its sign-in page lists the test accounts (all use the password `ConnectSphere-Test-1234!`; the [table below](#test-accounts) gives each account's role). Production, <https://connectsphere-is212.vercel.app>, runs the same release with no demo data and no test accounts.

| What you are looking for | Where it is |
|---|---|
| Product backlog | Jira project SPM: <https://smu-team-vkln2krm.atlassian.net/jira/software/projects/SPM/boards/2>. Export: [documentation/backlog/jira-export.xlsx](documentation/backlog/jira-export.xlsx). The user stories and their acceptance criteria: [documentation/final user stories.md](<documentation/final user stories.md>). |
| System design | The C4 model as code, with rendered diagrams: [documentation/c4/](documentation/c4/). ER, domain and state diagrams: [documentation/architecture/](documentation/architecture/). Decisions: [documentation/adr/](documentation/adr/) (ADR-0001 to ADR-0016; ADR-0004 to ADR-0016 are the current architecture). APIs: [documentation/api/](documentation/api/) (OpenAPI). |
| Customer changes and clarifications | Week 7 changes CR-01 to CR-06: [documentation/change-requests.md](documentation/change-requests.md). Questions to the customer, the Week 9 answers and the team's decisions D-01 to D-03: [documentation/clarifications.md](documentation/clarifications.md). |
| Test cases | One Markdown card per test case, in the Week 4 template ([tests/TEMPLATE.md](tests/TEMPLATE.md)), in `tests/<story>/`. Each card records its status, the commit, the CI run or hand run that backs it, and who ran it. How they are organised: [tests/README.md](tests/README.md). |
| Traceability | One CSV per story in [documentation/traceability/](documentation/traceability/) (`sprint-N/<story>.csv`) links each acceptance criterion to its tests. CI's "Traceability matrix" job builds the full matrix from each run's results. |
| Coverage | [documentation/testing/coverage.md](documentation/testing/coverage.md): each workspace's coverage as CI measured it, and why each one is below 100%. Domain code is held at 100% by CI. |
| CI/CD pipeline | [.github/workflows/](.github/workflows/) (`ci.yml` on every pull request and every push to main; `release.yml` deploys every merge to staging, then the same images to production after an approval). Runs: <https://github.com/joass1/event-planning-and-venue-booking-system/actions>. |
| Operations evidence | Screenshots of the live system (observability, deployments, access control): [documentation/evidence/operations/](documentation/evidence/operations/). Load, chaos and supply-chain evidence: [documentation/evidence/](documentation/evidence/), [documentation/reliability.md](documentation/reliability.md), [documentation/supply-chain.md](documentation/supply-chain.md). |
| Sprint records | Planning poker, meeting scripts and the Jira snapshot: [documentation/planning/](documentation/planning/). The Sprint 1 to 4 documents and the velocity and burndown charts are in folder 4 of the submission zip. |
| What changed, and when | One entry per change in [changelog/](changelog/) since 3 Nov 2026, and the earlier entries in [CHANGELOG.md](CHANGELOG.md). `npm run changelog` prints the whole log. |
| How we used AI | The rules every coding agent followed: [documentation/planning/implementation.md](documentation/planning/implementation.md) §11, "Rules for coding agents". Changelog entries and test cards name the person responsible and, where an AI tool did the work, say so ("Name, via Claude"). |

**The Week 12 submission zip** has seven folders, built from this repository by `npm run submission:build` (see [below](#week-12-submission-zip)). Its `MANIFEST.md` lists every part and whether it is present.

| Folder | Holds |
|---|---|
| 1. Product Backlog | The Jira export (`.xlsx` and `.json`). |
| 2. System Design (C4) | The C4 model, the ER, domain and state diagrams with an index of what each shows, the ADRs, the operations screenshots and the Operations Evidence PDF. |
| 3. Test Cases | The test cards, the traceability rows, the unit and end-to-end test-script workbooks, and the coverage statement. |
| 4. Sprint Meetings | The Sprint 1 to 4 documents, the Sprint 4 meeting scripts, the Week 11 slides, the Sprint Velocity and Burndowns PDF, and the links to the final sprint's recordings. |
| 5. Slide Deck | The slide deck as a PDF. |
| 6. Software Release | This repository's source at the submitted commit, without `node_modules`. |
| 7. README and Git Access | The repository link and the instructors' access. |

## Links

| | |
|---|---|
| Repository | <https://github.com/joass1/event-planning-and-venue-booking-system> |
| Staging (web) | <https://connectsphere-staging.vercel.app> (API: <https://api.staging.4.194.57.47.sslip.io>). Loaded with demonstration data; the sign-in page lists the test accounts. |
| Production (web) | <https://connectsphere-is212.vercel.app> (alias <https://connectsphere-blush.vercel.app>). No demo data and no account list on the sign-in page. |
| CI | <https://github.com/joass1/event-planning-and-venue-booking-system/actions/workflows/ci.yml> |
| Deploys | [documentation/deploy/README.md](documentation/deploy/README.md) |

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
3. `cp .env.example .env` and fill it in. Local development uses no Docker and runs nothing besides Node; containers are built only in CI (ADR-0012, which replaced ADR-0003's no-Docker rule):
   - **Supabase** — from the team's hosted project: the transaction pooler connection string (port 6543) as `DATABASE_URL`, plus `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_JWKS_URL`.
   - **Kafka** — the shared hosted cluster's bootstrap server and SASL credentials (`KAFKA_*`, ADR-0008). planning-core's and registration's outbox relays publish their messages there, and the notification and registration services consume them. `npm run kafka:check` tests the connection.
4. `npm run migrate:all` — applies every module's and service's schema in order (identity, event, venue, equipment, change, notification), plus the identity seed. Already-applied files are skipped, and `npm run migrate -- <module>` still runs one at a time.
5. `npm run seed:auth` — creates matching Supabase Auth users (password: see `backend/services/planning-core/migrations/identity/seed/seed-auth-users.ts`).
6. `npm test` — runs every workspace's test suite (unit and integration) and the script tests. Before you push, also run what CI runs on every pull request: `npm run lint` (ESLint plus the module boundary checks), `npm run typecheck` and `npm run test:unit`, which also checks coverage: domain code must stay at 100%. If the repo sits in OneDrive and Vitest can't clear an old `coverage/` folder (EPERM), delete the folder, or add `-- --coverage.clean=false` when running one workspace.
7. `npm run dev` — starts, in one terminal, the policy decision point, planning-core on `:8090` and its Temporal worker, the notification service on `:8091`, the registration service on `:8092` and the web app on <http://localhost:5173>, each line prefixed with where it came from. The Vite dev server proxies `/identity/*`, `/event/*`, `/venue/*` and `/equipment/*` to planning-core and the other paths to their services, so the browser only ever talks to one origin and the services need no CORS. To run just one: `npm run dev -w @connectsphere/planning-core` (or `web`).
8. **Permissions (EN-07).** `npm run dev` also starts the Cerbos policy decision point on `policies/` at `http://127.0.0.1:3592` (`CERBOS_URL`, or alone with `npm run cerbos:start`). Every planning-core route asks it, and the staff console's navigation asks it through `POST /api/v1/permissions/check`; Cerbos has no Windows build, so on Windows it runs the Linux build inside WSL (`wsl --install -d Ubuntu` once). Without WSL, planning-core evaluates `policies/` itself in development and its log says `LOCAL-POLICIES MODE`; production never does, and refuses with `503 POLICY_UNAVAILABLE` without a PDP. See `policies/README.md`.

### Running it without the team's secrets

Step 3 above needs the team's Supabase and Kafka secrets. You can still run the services and the browser journeys on a laptop the way CI's `e2e` job does: a throwaway local Postgres and a fake Supabase Auth server (`tests/e2e/support/fake-supabase-auth.ts`, which refuses to start outside the test harness).

1. Start a local Postgres (any empty database, for example `postgres://ci:ci@127.0.0.1:5432/connectsphere_e2e`) and export it as `DATABASE_URL`. The Playwright config refuses any database that is not on your own machine.
2. `npm ci`, then `npm run migrate:all` (every schema, with the identity seeds).
3. `npx playwright install chromium`, then `npm run test:e2e`. It starts the fake auth server, the policy decision point, planning-core, notification, registration and a built copy of the web app, then drives the browser. Kafka is not needed.

### Week 12 submission zip

`npm run submission:build -- --deliverables "<folder>" --zip-dir "<folder>"` assembles the seven
numbered folders the course asks for, writes `ConnectSphere.zip` and a `MANIFEST.md` that marks each
part present, placeholder or missing. The backlog comes from `documentation/backlog/jira-export.json`
(refresh with `npm run backlog:export`); the recordings and instructor access are human steps, kept as
placeholders in `documentation/week12-submission/`. Code repository:
<https://github.com/joass1/event-planning-and-venue-booking-system>.

### Deploying

Staging and production run on one Azure VM (the API), Vercel (the web app) and one Supabase project each (ADR-0016). A merge to `main` deploys staging; an approval deploys the same images to production. The runbook, the secrets each environment needs and how to roll back are in [documentation/deploy/README.md](documentation/deploy/README.md). The Kubernetes, Terraform and canary material (EN-10, EN-16, ADR-0012) is in [documentation/deploy.md](documentation/deploy.md). Local development stays as above: no Docker.

### Test accounts

Every account uses the password `ConnectSphere-Test-1234!`. They are seeded in staging and in local development (`npm run migrate:all` and `npm run seed:auth`). **Production has none**, and its sign-in page shows no list.

| Email | Role |
|---|---|
| `organiser@connectsphere.test`, `organiser2@connectsphere.test` | Event Organiser |
| `coordinator@connectsphere.test`, `coordinator2@connectsphere.test` | Event Coordinator |
| `lead@connectsphere.test` | Event Coordinator Lead (assigns coordinators) |
| `safety@connectsphere.test` | Safety Officer |
| `venuestaff@connectsphere.test` | Venue Staff |
| `techsupport@connectsphere.test` | Technical Support |
| `attendee@connectsphere.test` | Attendee |
| `deactivated@connectsphere.test` | A deactivated account (it is refused) |
| `attendee2@`, `attendee3@`, `attendee4@connectsphere.test` | Attendees, **staging only** (made by the demo seed) |

The sign-in page lists the accounts, and fills in the first, only in development and in the staging build.

### Demonstration data on staging

`npm run demo:seed -- --env staging` loads venues, equipment, events in every status, bookings, a hold, a block, a change request, registrations and a waitlist into staging through the application's own API. It refuses to run against anything but staging, reads its connection details from `connectsphere-secrets/staging.env` (never printed) and is safe to run again. See `deploy/demo/seed-staging.mjs`.

### Test evidence

- **Functional test cards:** `tests/<ID>/`, one Markdown card per case, with its execution record (status, commit, evidence, executor). Format and setup: [tests/README.md](tests/README.md).
- **Traceability matrix:** one CSV per story under `documentation/traceability/sprint-N/` links each acceptance criterion to an automated test. `npx tsx documentation/scripts/traceability-matrix.ts --summary` builds the matrix (story, criterion, test, last result); CI builds it on every run (job "Traceability matrix").
- **CI runs:** <https://github.com/joass1/event-planning-and-venue-booking-system/actions/workflows/ci.yml>. Each run holds lint, typecheck, unit tests with coverage thresholds, integration tests on a throwaway Postgres, mutation testing, the Playwright browser journeys, squawk, gitleaks and CodeQL, with the reports uploaded as artifacts.

### Coverage

[documentation/testing/coverage.md](documentation/testing/coverage.md) gives each workspace's statement and branch coverage as CI measured it, what is not measured, and why each workspace is below 100%. **Domain code (`src/**/domain/**`) must stay at 100%** of lines, branches, functions and statements; the unit-test step fails below that. The numbers move with every merge: the "Unit tests (with coverage thresholds)" and "Integration tests with coverage" steps of the latest run on `main` show the current ones.

How the images are inventoried, scanned and signed (SBOMs, Trivy, cosign, a ZAP baseline scan; EN-21), and how to verify an image yourself, is in [documentation/supply-chain.md](documentation/supply-chain.md).

### Trying the stories in the browser

Sign in at <http://localhost:5173> (or on staging) with any seeded account from the table above; the login screen lists them. What each story looks
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
| A4 | Sign in as `coordinator2@connectsphere.test` and open an event assigned to the other coordinator: it is refused as not assigned to you (404). |
| E3, E4, E5 | Sign in as `lead@connectsphere.test` → "Unassigned": assign a coordinator to a new request. "Assignments" shows each coordinator's events and workload, and reassigns an event. |
| F1, F2 | Every event page shows its status and its history: each change, who made it and when. |
| G1, G2, S1, S2, S3 | The coordinator edits an event's description and contact directly; its date, attendance, venue and equipment change only through a change request. The organiser requests one; the coordinator sees which bookings, reservations and registrations it would affect, then approves it or rejects it with a reason. An approved change flags each affected arrangement. |
| H1 to H3, I1 to I6 | Sign in as `venuestaff@connectsphere.test` → "Venues": add or edit a venue, with its layouts, facilities, accessibility, hours, and setup and turnaround times. A venue's availability calendar shows bookings, holds, setup and turnaround, and its unavailability page records a period the venue can't be used, with or without an end. |
| J1, J2, K1, K2 | As the coordinator, "Find a venue" from an event: filter by capacity, layout, facility, date and time, or search by name. Each result says whether it suits the event, and requesting an unsuitable venue needs a justification. |
| L1 to L6, M1, M2, N1, N2 | From the event, the coordinator requests a booking or a tentative hold. Venue Staff decide it in "Booking requests" or "Hold requests" (a rejection needs a reason). An overlapping request is marked as a conflict and its approval is refused; an expired hold frees the venue. |
| O1, O2, P1, P2, Q1, Q2 | The coordinator records the equipment an event needs. As `techsupport@connectsphere.test`, "Equipment requests" updates each line and reserves or releases stock for it, "Equipment availability" checks a quantity for a period, and "Equipment" keeps the inventory and its unavailability. |
| F3, F4 | The organiser cancels an event with a reason; its pending change requests close, and its bookings, holds and reservations are released. |
| F5, U1 | The coordinator confirms an event's arrangements, which sends it to `safety@connectsphere.test` → "Safety queue". The Safety Officer approves it, after which the coordinator marks it Confirmed, or requests changes with a reason, which returns it to Planning. |
| R1 to R7 | The organiser opens registration for an event. As `attendee@connectsphere.test`, "Events" lists the events open for registration and "My registrations" shows and withdraws yours; a full event offers its waitlist. The organiser and the coordinator see the registrations and can add an attendee by hand, above capacity after confirming. |
| T2 | "Notifications", for every role: what happened to the events, bookings, reservations and registrations you are related to. |

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

### Temporal workflows (EN-11)

Timers that must fire on their own, such as completing an event once its end time passes and
expiring a booking hold, are Temporal workflows (ADR-0009), run by planning-core's worker
(`npm run worker -w @connectsphere/planning-core`, which `npm run dev` also starts). In staging and
production the Temporal dev server runs inside each environment's container and keeps its state on
a volume, so a redeploy loses no timer; on start the worker also re-creates any timer that is
missing, and a sweep every five minutes completes anything a timer missed (EN-11-T4 to T6). The
recorded workflow histories in `backend/services/planning-core/tests/temporal/histories/` are
replayed by a unit test on every CI run, so a change that breaks a running workflow fails the build
(EN-11-T3).

To check a connection to a Temporal server without starting workflows or touching data, set
`TEMPORAL_ADDRESS` (host:port), `TEMPORAL_NAMESPACE`, `TEMPORAL_API_KEY` and `TEMPORAL_TASK_QUEUE`
in the root `.env` and run `npm run temporal:check`. It reads only the `TEMPORAL_*` values and never
prints credentials.
