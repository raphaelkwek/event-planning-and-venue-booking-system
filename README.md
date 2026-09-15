# event-planning-and-venue-booking-system

## Local development

1. `nvm use` (Node 20 — see `.nvmrc`).
2. `npm install` from the repo root.
3. `npx supabase init && npx supabase start` — starts local Postgres + Auth. Note the printed `API URL`, `anon key`, `service_role key`, and `DB URL`.
4. `cp .env.example .env` and fill in `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWKS_URL` from step 3.
5. `npm run migrate:identity` — applies the identity schema and seed SQL.
6. `npm run seed:auth` — creates matching Supabase Auth users (password: see `services/identity/migrations/seed/seed-auth-users.ts`).
7. `npm test --workspaces` — runs every service and package's test suite.
8. `npm run dev -w @connectsphere/identity-service` — runs the Identity service on `:8081` (see `.env`'s `PORT`).

See `Planning/plan.md` for architecture and `Planning/implementation.md` for the mandatory formats every service follows.