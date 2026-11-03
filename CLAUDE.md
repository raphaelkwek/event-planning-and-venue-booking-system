# ConnectSphere — notes for Claude Code

Read `documentation/planning/implementation.md` before writing code; it is mandatory for every
agent. Its §2 is the repository layout — `frontend/`, `backend/`, `documentation/`, `tests/`. If
you remember `apps/web`, `services/`, `packages/`, `Planning/` or `docs/` at the root, that layout
is gone.

The architecture is ADR-0004 to ADR-0015 (`documentation/adr/`), accepted on 2026-10-01: a modular
`planning-core` plus registration and notification services. Where `implementation.md` still
describes the older six-service design, the ADR wins (see the note at the top of that file).

Staff-facing code lives in `backend/services/planning-core/src/modules/<module>/` (identity, event,
venue, equipment, change). `backend/services/identity` and `backend/services/event` were merged into
it on 2026-10-02 (EN-01). A module reads another module's data only through that module's
`index.ts`; run `npm run lint:boundaries` before you push, as it fails on any other import or on SQL
naming another module's schema.

Containers are allowed, but only in CI. ADR-0012 supersedes ADR-0003's no-Docker rule: container
images are built in CI and deployed by EN-10. Local development doesn't use Docker. Supabase is the
team's hosted project, Kafka is one hosted cluster reached through the `KAFKA_*` variables, and
`npm run dev` at the root starts the services and the web app. Don't add a `docker-compose.yml`,
Testcontainers or `supabase start` for local work. CI integration tests run against an ephemeral
Postgres on the runner, never the shared database (EN-06).

## Files every pull request touches

Since 3 Nov 2026 these are one file per change, so that pull requests stop conflicting
(implementation.md §8.2, §11.2):

- **Changelog:** add `changelog/<YYYY-MM-DD>-<branch-or-slug>.md`, holding exactly what a
  `CHANGELOG.md` entry holds. Don't edit `CHANGELOG.md`; it keeps the older entries.
  `npm run changelog` prints the whole log.
- **Traceability:** add rows to `documentation/traceability/sprint-<n>/<story-id>.csv`, the story's
  own file, with the usual header. There is no `sprint-<n>.csv` any more.
- **Error codes:** put a new code at its alphabetical place in `ERROR_CODES` and in the OpenAPI
  `ErrorCode` enum, not at the end. `npm run lint:api` checks the order.

## Superpowers plugin

Superpowers specs go in `documentation/superpowers/specs/`, and plans in
`documentation/superpowers/plans/`, not `docs/superpowers/`. A plan's `.tasks.json` sits beside the
plan.
