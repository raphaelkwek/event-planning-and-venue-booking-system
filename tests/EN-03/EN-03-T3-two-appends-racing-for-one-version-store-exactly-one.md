# EN-03-T3 — Two appends racing for the same version store exactly one

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T3 |
| Test Scenario | Two appends racing for the same version store exactly one |
| Category | Negative (concurrency) |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T3` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | Two transactions on separate connections, released together, each appending a status change to the same event without locking its row. |
| Expected Result | Exactly one transaction commits. The other is refused because the version was taken (`unique(aggregate_id, version)`), and nothing it tried to write is stored. The event's stream has one entry, version 1, and its chain verifies. |
| Acceptance criterion | An append-only `event.event_stream` with `unique(aggregate_id, version)` and a hash chain (`prev_hash`, `hash`). |
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
