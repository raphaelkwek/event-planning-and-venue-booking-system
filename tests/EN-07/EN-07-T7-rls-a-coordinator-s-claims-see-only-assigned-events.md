# EN-07-T7 — Under the request role with a coordinator's claims, only events actively assigned to them are visible, and a reassignment moves them at once (A4)

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T7 |
| Test Scenario | Under the request role with a coordinator's claims, only events actively assigned to them are visible, and a reassignment moves them at once (A4) |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root.<br>2. A Cerbos policy decision point serving `policies/` at `CERBOS_URL` (`npm run cerbos:start`, or CI's Cerbos service container).<br>3. `DATABASE_URL` pointing at a throwaway Postgres built with `npm run migrate:all` (in CI, the runner's own Postgres). Never the team's shared database. |
| Test Steps | 1. Create event X assigned to coordinator C1, event Y assigned to C2, and an unassigned submitted event Z.<br>2. As the request role with C1's claims (assigned scope), `select id from event.events` and `select event_id from event.assignments` (no WHERE).<br>3. Reassign X to C2 (deactivate C1's assignment, add C2's), and repeat step 2. |
| Test Data | Random coordinator ids; scope `ASSIGNED_TO_USER`. |
| Expected Result | Before the reassignment C1 sees exactly X, in both tables. After it, C1 sees no event and no assignment. C1 never sees Y or Z. |
| Acceptance criterion | AC2: A3 (and A4's assigned-only scope) enforced with Postgres row-level security, using a per-request role and `SET LOCAL` claims inside each transaction. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | C1 saw exactly X in events and in assignments; after X was reassigned to C2, C1 saw neither, and C2 saw X and Y. Nobody's claims saw the unassigned Z. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7f1c8fa · Evidence: backend/services/planning-core/tests/event/repo/rowLevelSecurity.test.ts › EN-07-T7 a coordinator's claims see only the events assigned to them, and a reassignment moves them at once (A4), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
