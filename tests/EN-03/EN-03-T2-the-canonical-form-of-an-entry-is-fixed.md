# EN-03-T2 — The canonical form an entry is hashed over is fixed and documented

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T2 |
| Test Scenario | The canonical form an entry is hashed over is fixed and documented |
| Category | Boundary |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T2` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | A fixed entry: id `00000000-0000-4000-8000-000000000001`, aggregate `00000000-0000-4000-8000-000000000002`, version 1, a field change of `description` from `Line one` to `Café "quoted"\n`, no acting user, role `SYSTEM`, at `2026-11-03T01:02:03.456789Z`. |
| Expected Result | The canonical text is exactly the documented string: keys in the documented order, one space after each colon and comma, the acting user as JSON `null`, the quote and the newline escaped, `é` kept as itself, and the time in UTC with six fractional digits. Its hash is the SHA-256 of the genesis value followed by that text. |
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
