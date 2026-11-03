# EN-03-T8 — A history row written without the append function still reaches the stream

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T8 |
| Test Scenario | A history row written without the append function still reaches the stream |
| Category | Negative |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T8` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | A seeded event. One `insert into event.event_history` of a status change, as a test fixture or a hand-written fix would do, with no call to the append function. |
| Expected Result | The same statement also appends the entry to the stream, with the row's id and values, as the event's next version, chained to its previous entry. An insert the history table refuses (a status change naming no new status) stores nothing in either table. |
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
