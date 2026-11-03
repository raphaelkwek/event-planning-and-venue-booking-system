# EN-07-T9 — The role and claims are transaction-local, so a transaction-mode pooler cannot hand them to the next request

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T9 |
| Test Scenario | The role and claims are transaction-local, so a transaction-mode pooler cannot hand them to the next request |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root.<br>2. A Cerbos policy decision point serving `policies/` at `CERBOS_URL` (`npm run cerbos:start`, or CI's Cerbos service container).<br>3. `DATABASE_URL` pointing at a throwaway Postgres built with `npm run migrate:all` (in CI, the runner's own Postgres). Never the team's shared database. |
| Test Steps | 1. Reserve one database connection.<br>2. On it, run a scoped read for organiser A (the request role and A's claims, inside a transaction) and commit.<br>3. On the same connection, outside any transaction, read `current_user`, `current_setting('app.user_id', true)` and `current_setting('app.access_scope', true)`.<br>4. Repeat with a scoped read that throws, so the transaction rolls back. |
| Test Data | One reserved connection; organiser A's id. |
| Expected Result | Inside the transaction `current_user` is `connectsphere_request` and the claims are A's. Afterwards, after both commit and rollback, `current_user` is the service's login role again and both claims are empty. Nothing is set at session level. |
| Acceptance criterion | AC2: A3 (and A4's assigned-only scope) enforced with Postgres row-level security, using a per-request role and `SET LOCAL` claims inside each transaction. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | On one reused connection, the read ran as connectsphere_request with A's claims; afterwards, after a commit and after a rollback, current_user was the login role again and both claims were empty. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7f1c8fa · Evidence: backend/services/planning-core/tests/event/repo/rowLevelSecurity.test.ts › EN-07-T9 the role and claims last only for their transaction, after a commit and after a rollback, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
