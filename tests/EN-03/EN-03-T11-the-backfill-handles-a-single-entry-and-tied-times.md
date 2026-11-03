# EN-03-T11 — The backfill handles an event with one entry and entries recorded at the same time

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T11 |
| Test Scenario | The backfill handles an event with one entry and entries recorded at the same time |
| Category | Boundary |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T11` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | Event A: one pre-stream history row. Event B: three pre-stream rows with the same `occurred_at`, recorded one after another. |
| Expected Result | Event A's stream has one entry, version 1, whose `prev_hash` is the genesis value. Event B's three entries are versions 1 to 3 in the order the rows were recorded. Both chains verify. An event with no history has no stream entries. |
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
