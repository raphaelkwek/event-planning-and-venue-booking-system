# EN-03-T10 — Running the backfill again adds nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T10 |
| Test Scenario | Running the backfill again adds nothing |
| Category | Negative (idempotency) |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T10` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | The event from EN-03-T9, after its backfill. The backfill run a second time. |
| Expected Result | The second run reports 0 entries copied. The event's stream still has exactly four entries, unchanged, and the chain verifies. |
| Acceptance criterion | The existing A–E history (`event_history`) is migrated into the stream. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
