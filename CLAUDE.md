# ConnectSphere — notes for Claude Code

Read `documentation/planning/implementation.md` before writing code; it is mandatory for every
agent. Its §2 is the repository layout — `frontend/`, `backend/`, `documentation/`, `tests/`. If
you remember `apps/web`, `services/`, `packages/`, `Planning/` or `docs/` at the root, that layout
is gone.

## Superpowers plugin

Superpowers specs go in `documentation/superpowers/specs/`, and plans in
`documentation/superpowers/plans/`, not `docs/superpowers/`. A plan's `.tasks.json` sits beside the
plan.
