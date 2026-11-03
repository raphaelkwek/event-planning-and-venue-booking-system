# EN-03-T4 — The stream refuses updates, deletes and truncation, and the app role may only insert and read

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T4 |
| Test Scenario | The stream refuses updates, deletes and truncation, and the app role may only insert and read |
| Category | Negative |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T4` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | One appended entry. Then `update event.event_stream set data = …`, `delete from event.event_stream where id = …` and `truncate event.event_stream`, each run on its own. |
| Expected Result | Each of the three statements fails with a message saying the stream is append-only, and the entry is unchanged afterwards. The table's privileges give the role the app connects as SELECT and INSERT only, and give no other role anything. |
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
