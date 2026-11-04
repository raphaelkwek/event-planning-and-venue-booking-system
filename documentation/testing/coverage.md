# Test coverage: the figures, and why each workspace is below 100%

The Week 4 rubric asks for "100% coverage unless not possible and stated why". This page gives each
workspace's coverage as CI measured it, what is not measured or not covered, and why. The reasons
were in comments in each workspace's Vitest config; they are collected and checked against the
coverage reports here.

**Source of the figures:** CI run [41777894379](https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41777894379)
on `main` at `d1e6c08`, the commit both environments run. The numbers are the job logs' coverage
summaries; the per-file detail is from that run's `coverage-reports` artifact (the HTML and
`coverage-summary.json` of each workspace). planning-core's per-file detail on its integration run
was not uploaded by that run; it is uploaded from now on (`coverage-integration`), and the list below
comes from this change's own run, as said there.

## How coverage is measured

- Vitest's v8 provider, over `src/**` of each workspace (`coverage.include` in each config). Test
  files, scripts, migrations and configuration are outside `src/` and are not counted.
- Each workspace is measured on its **unit run** (`npm run test:unit`, CI's checks job), except
  **planning-core**, which is measured on its **integration run** (`npm run test:coverage`, CI's
  integration job, against a throwaway Postgres), because its `api/` and `repo/` code only runs with
  a database (`backend/services/planning-core/vitest.unit.config.ts`, the comment on `coverage`).
- **Domain code is held at 100%** of lines, branches, functions and statements: every
  `src/**/domain/**` (planning-core, registration, notification) and contracts' `src/compat/**`. Below
  that, the build fails (implementation.md §8.1). The domain rules are also mutation-tested: below an
  80% mutation score on the changed domain files, the build fails (EN-06.2).
- Everything else has a floor just under the figure measured when it was set, which may only rise
  (implementation.md §8.1, "Coverage (SPM-116)").
- **Not measured at all:** the browser tests (Playwright, `tests/e2e`), the script tests (node:test:
  `documentation/scripts`, `deploy/**`, `gateway/tests`, `.github/scripts`), the load and chaos
  harnesses, and the cards checked by hand. They pass or fail; they add nothing to the percentages
  below, although much of the code the percentages call uncovered runs in them.

## Summary

| Workspace | Measured on | Statements | Branches | Domain code | Why not 100%, in one line |
|---|---|---|---|---|---|
| planning-core | integration (and unit for domain) | 96.19% (20,987 / 21,817) | 92.1% (4,130 / 4,484) | 100% | The process entry points and the Kafka and Temporal wiring, which CI's tests never start; defensive branches |
| registration | unit | 98.23% (4,463 / 4,543) | 97.44% (954 / 979) | 100% | `src/index.ts` and `src/telemetry.ts` (process start), and the consumer loop's error branches |
| notification | unit | 93.22% (1,431 / 1,535) | 93.66% (355 / 379) | 100% | The repository and list query, which only its integration tests run (not measured), and the process start |
| web | unit (jsdom) | 93.09% (12,800 / 13,750) | 86.92% (2,407 / 2,769) | n/a | Screens and API clients that only the browser tests walk (not measured), and `src/main.tsx` |
| contracts | unit | 97.47% (2,320 / 2,380) | 98.93% (280 / 283) | 100% (`src/compat`) | Three schema files no contracts test imports; the services' tests use them |
| telemetry | unit | 99.87% (821 / 822) | 92.63% (176 / 190) | n/a | Defensive branches for values the libraries never pass |
| kafka | unit | 100% (194 / 194) | 100% (48 / 48) | n/a | — |
| observability | unit | 100% (107 / 107) | 100% (24 / 24) | n/a | — |

## Per workspace

### planning-core

- **Config:** `backend/services/planning-core/vitest.config.ts` (integration run, floors 94% lines and
  statements, 89% branches, 94% functions, "Just under CI's first measurement of main (2026-10-07 …).
  Only ever raise these."); `vitest.unit.config.ts` (unit run, 100% on `src/**/domain/**`, and no floor
  elsewhere because "only a database run executes it").
- **Unit run alone:** 59.93% statements, 94.98% branches. That figure is not the workspace's coverage:
  the unit run leaves `api/` and `repo/` to the integration run by design, and the config says so.
- **Uncovered on the integration run (830 statements, 354 branches):** see "planning-core per file"
  below.
- **Why:** CI's integration job runs planning-core's tests in one process with `KAFKA_*` blank and no
  Temporal server, so what only a running deployment does is never executed there: `src/index.ts` and
  `src/worker.ts` start the HTTP server, the outbox relay's publisher and the Temporal worker; the
  relay's Kafka producer and the Temporal workflows' worker wiring need a broker and a server. These run
  in the browser tests' stack, the Deploy workflow's Space image smoke test and the deployed
  environments, none of which measures coverage. The branches left are mostly defensive (a driver
  error code other than the ones a constraint raises, a header that is absent) and refusals the API
  tests reach through another route.

### registration

- **Config:** `backend/services/registration/vitest.unit.config.ts`: 100% on `src/**/domain/**`; floors
  of 97% lines and statements, 96% branches and functions. Its comment: the seat SQL, the consumer's
  transaction and the Kafka wiring are unit-tested with a scripted database client
  (`tests/support/scriptedSql.ts`), and "the integration tests still prove them against Postgres in CI".
- **Uncovered:** `src/index.ts` (63 statements, 0%) and `src/telemetry.ts` (10, 0%), which start the
  process and the OpenTelemetry SDK; `src/consumer/run.ts` (6 statements, 8 branches): the clean-up
  when a consumer fails to connect, and the log lines for each outcome. One or two defensive branches
  each in `config.ts`, `app.ts`, `db.ts`, the API routes and the repositories.
- **Why:** importing `index.ts` starts a server and connects to Kafka, so no unit test imports it; the
  browser tests' stack and the deployments start it. The rest are branches for inputs the callers never
  give (an unset optional setting, a driver error other than the one expected).

### notification

- **Config:** `backend/services/notification/vitest.unit.config.ts`: 100% on `src/**/domain/**` (the
  recipient rules and the retry policy); floors of 69% lines and statements, 83% branches, 64%
  functions. Its comment: "the inbox transaction and the Kafka wiring (run.ts) are covered by
  integration tests against a database, which CI runs from EN-06.1."
- **Uncovered:** `src/index.ts` (50 statements, 0%) and `src/telemetry.ts` (10, 0%), the process start;
  `src/repo/notifications.ts` (29 statements, 5 branches) and the list handler in
  `src/api/notifications.ts` (7 statements, 8 branches): reading, paging and marking notifications in
  the database; `src/consumer/run.ts` (8 statements): connecting the consumers.
- **Why:** the repository and the list query run only against Postgres, in
  `tests/api/notifications.test.ts` and `tests/consumer/handleMessage.test.ts`, which CI's integration
  job runs but does not measure (only planning-core's integration run collects coverage). Measuring the
  notification integration run as well would close most of the gap; it has not been set up.

### web

- **Config:** `frontend/vitest.config.ts`: floors of 60% lines and statements, 70% branches, 40%
  functions ("The floor sits just under today's figures and should only ever go up"). The web app has
  no `domain/` folder, so no 100% gate.
- **Uncovered (950 statements, 362 branches, in 75 of 99 files):** 635 statements are in screens, 249
  in the API clients, 66 elsewhere. The largest: `src/screens/DraftEditor.tsx` (317 statements, 12.9%
  covered) and `src/screens/RequestDetail.tsx` (104), which have no jsdom test at all;
  `src/api/events.ts` (69), `src/screens/ApiConsole.tsx` (56), `src/api/registration.ts` (45),
  `src/screens/ReviewDetail.tsx` (43 statements, 20 branches), `src/api/session.ts` (38); `src/main.tsx`
  (21, 0%), which mounts the app.
- **Why:** the screens left uncovered are the ones whose journeys are tested in a real browser instead
  (`tests/e2e`: drafts and submission in `b-event-requests.spec.ts`, review in `d-review.spec.ts`, and
  so on), and Playwright measures no coverage. That is a choice, not an impossibility: jsdom tests of
  DraftEditor and RequestDetail would raise the figure most. `main.tsx` only renders the app into the
  page, which jsdom tests do themselves.

### contracts

- **Config:** `backend/packages/contracts/vitest.config.ts`: 100% on `src/compat/**` (the schema
  compatibility checker, EN-05); a floor of 15% lines and statements, 10% branches, 0% functions
  elsewhere. Its comment: "Most of contracts is schema declarations its own tests don't import;
  planning-core's tests exercise them."
- **Uncovered:** `src/user.ts` (20 statements), `src/index.ts` (17), `src/venueHolds.ts` (16), all 0%,
  and 7 statements of `src/eventEvents.ts`.
- **Why:** these are declarations (zod schemas, constant lists and the re-exports in `index.ts`) that
  the services' tests use through the package, and that run in every service; contracts' own tests
  cover the schemas they check. The floor is far below the figure; it was set when contracts' tests
  covered much less, and it should be raised to just under today's 97%.

### telemetry

- **Config:** `backend/packages/telemetry/vitest.config.ts`: floors of 95% lines, statements and
  functions, 85% branches.
- **Uncovered:** 1 statement and 14 branches, in `src/kafka.ts` (6), `src/postgres.ts` (5), `http.ts`,
  `sdk.ts` and `testing.ts` (1 each).
- **Why:** the branches are defensive: a thrown value that is not an `Error`, a Kafka message without a
  partition, offset or key, a query without a text. kafkajs and postgres.js never give these in the
  tests' paths; they are kept so a span is never lost when a library does.

### kafka and observability

100% of statements and branches. Nothing left.

## planning-core per file

Filled from this change's CI run once its `coverage-integration` artifact exists (the per-file summary
of planning-core's integration run). See the pull request for the run.
