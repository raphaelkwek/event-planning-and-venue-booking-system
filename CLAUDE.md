# ConnectSphere — notes for Claude Code

Read `documentation/planning/implementation.md` before writing code; it is mandatory for every
agent. Its §2 is the repository layout — `frontend/`, `backend/`, `documentation/`, `tests/`. If
you remember `apps/web`, `services/`, `packages/`, `Planning/` or `docs/` at the root, that layout
is gone.

The project does not use Docker (`documentation/adr/0003-no-docker-hosted-kafka.md`). Do not add a
Dockerfile, a `docker-compose.yml`, Testcontainers or `supabase start`. Supabase is the team's
hosted project, Kafka is one hosted cluster reached through the `KAFKA_*` variables, and
`npm run dev` at the root starts the services and the web app.

## Superpowers plugin

Superpowers specs go in `documentation/superpowers/specs/`, and plans in
`documentation/superpowers/plans/`, not `docs/superpowers/`. A plan's `.tasks.json` sits beside the
plan.
