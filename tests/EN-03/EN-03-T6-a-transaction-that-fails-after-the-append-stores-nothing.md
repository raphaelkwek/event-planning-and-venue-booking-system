# EN-03-T6 — A transaction that fails after the append stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T6 |
| Test Scenario | A transaction that fails after the append stores nothing |
| Category | Negative |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T6` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | A seeded Under Review event. Inside one transaction: F1's `APPROVE` transition, then an error thrown before the commit. |
| Expected Result | Nothing is stored: the event is still Under Review, and it has no new stream entry, no new `event_history` row and no new outbox message. |
| Acceptance criterion | Projections update in the same transaction as the append, together with the outbox row. |
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
