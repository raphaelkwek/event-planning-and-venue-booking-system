# EN-07-T8 — The Lead's claims see every event except other people's drafts; claims with no events scope, or no claims at all, see nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T8 |
| Test Scenario | The Lead's claims see every event except other people's drafts; claims with no events scope, or no claims at all, see nothing |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root.<br>2. A Cerbos policy decision point serving `policies/` at `CERBOS_URL` (`npm run cerbos:start`, or CI's Cerbos service container).<br>3. `DATABASE_URL` pointing at a throwaway Postgres built with `npm run migrate:all` (in CI, the runner's own Postgres). Never the team's shared database. |
| Test Steps | 1. Create a submitted event and a draft owned by organiser A.<br>2. As the request role with the Lead's claims (scope `ALL`), select every event.<br>3. Repeat with Venue Staff's claims (scope `NONE`), then with no claims set. |
| Test Data | Scopes `ALL`, `NONE`, and none. |
| Expected Result | The Lead sees the submitted event and not A's draft. Scope `NONE` sees no row. With no claims set the request role sees no row (it fails closed rather than seeing everything). |
| Acceptance criterion | AC2: A3 (and A4's assigned-only scope) enforced with Postgres row-level security, using a per-request role and `SET LOCAL` claims inside each transaction. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The Lead's claims saw the submitted event but not A's draft; scope NONE and no claims at all saw no row. The request role could lock an event in scope, and its update was refused by row-level security. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7f1c8fa · Evidence: backend/services/planning-core/tests/event/repo/rowLevelSecurity.test.ts › EN-07-T8 the Lead's claims see every event but other people's drafts; no scope, or no claims, see nothing; EN-07-T8 the request role can lock an event in scope but never change one, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
