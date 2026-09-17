# Proposal — reorganise the repository into frontend, backend, documentation and tests

**Date:** 2026-09-17
**Raised by:** Seann
**Status:** proposed — needs team agreement before anything moves
**Affects:** everyone. `Planning/implementation.md` §2 is the layout every teammate's agent follows.

## Why

Eleven top-level entries mix three kinds of thing: the app (`apps/`), the services and their data
(`services/`, `packages/`, `supabase/`, `scripts/`), and writing about the project (`Planning/`,
`documentation/`, `docs/`). Two folders — `docs/` and `documentation/` — even have the same job. The
proposal groups everything by what it is, so a new file has one obvious home.

## Proposed layout

```
frontend/                   the web app (was apps/web) — one app for every role, per plan.md §3
backend/
  services/                 identity, event, and the four still to come
  packages/contracts/       shared event schemas, types and error codes
  scripts/                  migrate.ts
  supabase/                 Supabase CLI config
  tsconfig.base.json        only the services extend it
documentation/
  planning/                 plan.md, implementation.md, Jira__2_.md (was Planning/)
  adr/  transcript/         as now
  proposals/                decisions still being agreed, like this one
  superpowers/              specs and plans from the Superpowers plugin (was docs/superpowers/)
  traceability/             sprint-<n>.csv (was packages/testkit/sprint-<n>/traceability.csv)
  scripts/                  confluence-digest.ts and its test
  Final_User_Stories__2_.md, sprint-reallocation.csv
tests/                      functional test cases, one folder per story (as now)
  <story-id>/               the case .md files, and each case's automated script alongside
  flows/sprint-<n>/         full-stack flow tests: flow.md, seed.sql, flow.spec.ts (was packages/testkit)
  fixtures/                 test-data reset
CHANGELOG.md  README.md  CLAUDE.md
package.json  package-lock.json  docker-compose.yml  .env  .env.example  .gitignore  .nvmrc
```

### Why `tests/` is a fourth top-level folder, not part of the other three

From next sprint each story folder will hold its functional test cases **and** the automated script
that executes them. Those scripts drive the running web app against the running services, so they
belong to neither half — and the sprint flow tests in implementation.md §8.2 span every service at
once. Unit and integration tests stay where they are, next to the code they test
(`backend/services/*/tests`, `frontend/tests`).

### What stays at the root, and why

| File | Reason |
|---|---|
| `package.json`, `package-lock.json` | npm workspaces only work from the root. |
| `.env`, `.env.example` | Both halves read one file; splitting it would duplicate the Supabase settings. |
| `docker-compose.yml` | It runs the whole stack, and every Dockerfile builds from the repo root. |
| `CHANGELOG.md` | implementation.md §11.2 and the Confluence digest both expect it here. |
| `README.md` | GitHub shows it on the repo's front page. |
| `CLAUDE.md` *(new)* | Claude Code reads it from the root. See below. |

## The Superpowers plugin

Its specs and plans can move. Their location is an instruction inside the skill text, not a hardcoded
path — the brainstorming skill says outright that a user's preference overrides its default, and the
writing-plans skill only requires a plan's `.tasks.json` to sit beside the plan. No hook reads either.

To make that stick for everyone, add a root `CLAUDE.md` containing:

> Superpowers specs go in `documentation/superpowers/specs/`, and plans in
> `documentation/superpowers/plans/`, not `docs/superpowers/`.

Do not edit the plugin itself; the next plugin update would overwrite the change.

**One exception to know about.** If anyone later runs the plugin's onboarding and enables its opt-in
`workflow.json` or `model-routing.json`, those two files must live in `docs/superpowers/` (or
`~/.claude/superpowers/`) — the plugin's hooks look only there. The project uses neither today.

## What has to change besides moving folders

At least these, all verified by building and running every test suite before the commit lands:

- Root `package.json` — workspace globs become `frontend`, `backend/services/*`, `backend/packages/*`;
  the `migrate`, `seed:auth`, `confluence:digest` and `test-cases:reset` script paths.
- `backend/scripts/migrate.ts` — it builds the path `services/<name>/migrations`.
- Each service — `tsconfig.json` `extends`, `vitest.config.ts` `.env` path, and the `--env-file` in
  its `dev` script all gain one `../`.
- Both Dockerfiles and `docker-compose.yml` — every `COPY` and `dockerfile:` path.
- `frontend/vite.config.ts` — the repo-root path it reads `.env` from.
- `package-lock.json` — regenerated.
- The Supabase CLI — run as `npx supabase --workdir backend …`.
- `implementation.md` §2's layout, plus path mentions in §7 (`apps/web/...`), §8.2 (`/packages/testkit`)
  and §8.4; `plan.md`'s reference to `/docs/sprint-reallocation.csv`; `README.md`.
- The traceability CSVs' `test_file` column, which holds paths.
- `CLAUDE.md` created, as above.
- `CHANGELOG.md`'s history is a record and keeps the old paths.

## How to do it without breaking anyone's work

1. **Agree the layout** in the team channel, including the open questions below.
2. **Everyone pushes** their work in progress and says so. The move is a rename of nearly every file,
   so any branch still open afterwards will conflict.
3. **One person makes one commit** using `git mv`, so file history follows the files. Nothing else
   goes in that commit.
4. Every build and every test suite runs green before it is pushed.
5. **Everyone pulls** before touching the repo again, and tells their Claude session the layout
   changed — agents may still have the old §2 layout in context.

Best done at a sprint boundary, not mid-sprint.

## Open questions for the team

1. Should `frontend/` be the app itself (proposed), or `frontend/web/` in case the attendee surface
   of implementation.md §7.2 becomes a separate app? plan.md §3 currently says one app for all roles.
2. `backend/packages/contracts` is only imported by services today. If the web app starts importing
   shared types from it, is a top-level `shared/` clearer?
3. Is Chai happy for the Confluence digest to move under `documentation/scripts/`?
