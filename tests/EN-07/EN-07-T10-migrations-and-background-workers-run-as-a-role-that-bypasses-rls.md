# EN-07-T10 — The migrator, the outbox relay and the Temporal worker run as the service's login role, which RLS does not restrict

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T10 |
| Test Scenario | The migrator, the outbox relay and the Temporal worker run as the service's login role, which RLS does not restrict |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root.<br>2. A Cerbos policy decision point serving `policies/` at `CERBOS_URL` (`npm run cerbos:start`, or CI's Cerbos service container).<br>3. `DATABASE_URL` pointing at a throwaway Postgres built with `npm run migrate:all` (in CI, the runner's own Postgres). Never the team's shared database. |
| Test Steps | 1. Run `npm run migrate:all` on an empty database.<br>2. With RLS enabled, as the login role (no `SET ROLE`, no claims), count `event.events` and `event.assignments`.<br>3. Run the outbox relay tests. |
| Test Data | The throwaway database after the migrations and the test suite's own events. |
| Expected Result | Every migration applies. The login role, which owns the tables, sees every row without claims, so the relay, the hold-expiry job and the Temporal worker are unaffected. The request role, without claims, sees none. `documentation/` names which role each path uses. |
| Acceptance criterion | AC2: A3 (and A4's assigned-only scope) enforced with Postgres row-level security, using a per-request role and `SET LOCAL` claims inside each transaction. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | npm run migrate:all applied every migration; the login role saw the event and its assignment with no claims, RLS was enabled and not forced on both tables, the request role without claims saw none, and the outbox relay tests passed. implementation.md §6 names the roles. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7f1c8fa · Evidence: backend/services/planning-core/tests/event/repo/rowLevelSecurity.test.ts › EN-07-T10 the login role the migrator, relay and worker use sees every row without claims; the request role sees none; backend/services/planning-core/tests/shared/outboxRelay.test.ts, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
