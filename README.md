# event-planning-and-venue-booking-system

| Folder | Holds |
|---|---|
| `frontend/` | The web app, one for every role. |
| `backend/` | The services, the shared `contracts` package, the migration script and the Supabase CLI config. |
| `documentation/` | Planning (`plan.md`, `implementation.md`), ADRs, proposals, user stories, Superpowers specs and plans, traceability. |
| `tests/` | Functional test cases, one folder per user story. Unit and integration tests live beside their code. |

## Local development

1. `nvm use` (Node 20 — see `.nvmrc`).
2. `npm install` from the repo root.
3. `npx supabase start --workdir backend` — starts local Postgres + Auth. Note the printed `API URL`, `anon key`, `service_role key`, and `DB URL`. (A hosted Supabase project works too; point `DATABASE_URL` at its pooler.)
4. `cp .env.example .env` and fill in `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL` from step 3.
5. `npm run migrate:identity` — applies the identity schema and seed SQL.
6. `npm run migrate:event` — applies the event schema.
7. `npm run seed:auth` — creates matching Supabase Auth users (password: see `backend/services/identity/migrations/seed/seed-auth-users.ts`).
8. `npm test --workspaces` — runs every service and package's test suite.
9. `npm run dev -w @connectsphere/identity-service` — runs the Identity service on `:8081`.
10. `npm run dev -w @connectsphere/event-service` — runs the Event service on `:8082`. It calls Identity on every request to resolve the caller's role and access scope, so start Identity first.

11. `npm run dev -w @connectsphere/web` — the web app on <http://localhost:5173>. Start both services first: the Vite dev server proxies `/identity/*` to `:8081` and `/event/*` to `:8082`, so the browser only ever talks to one origin and neither service needs CORS.

### Trying the stories in the browser

Sign in at <http://localhost:5173> with any seeded account; the login screen lists them and they all
use the password in `backend/services/identity/migrations/seed/seed-auth-users.ts`. What each story looks
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

Tests run against a real database. The event suite is not parallelised across files because those files share one database, including the single assignment-cursor row.

### Updating the Confluence sprint log

`CHANGELOG.md` is the single point of authorship for "what got done, when" — don't hand-type the
same thing into Confluence a second time. Instead, generate the table from it:

```
npm run confluence:digest                    # every entry, chronological
npm run confluence:digest -- --since 2026-09-16   # only what's new since a date
```

Paste the output straight into the Confluence page as a table. `--out <path>` writes it to a file
instead of stdout; `--order desc` matches CHANGELOG.md's own newest-first order if you'd rather
read it that way.

See `documentation/planning/plan.md` for architecture and `documentation/planning/implementation.md` for the mandatory formats every service follows, including the repository layout (§2).
