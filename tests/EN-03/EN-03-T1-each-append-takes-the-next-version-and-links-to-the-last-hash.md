# EN-03-T1 — Each append takes the next version and links to the previous entry's hash

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T1 |
| Test Scenario | Each append takes the next version and links to the previous entry's hash |
| Category | Happy path |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T1` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | A seeded Submitted event with no history. Three entries appended in order: a status change Submitted → Under Review by a coordinator, a field change of `purpose`, a status change Under Review → Approved. |
| Expected Result | The stream holds three entries for the event, versions 1, 2 and 3. Version 1's `prev_hash` is the genesis value (64 zeros). Each later entry's `prev_hash` equals the previous entry's `hash`. Each `hash` equals SHA-256, in lowercase hex, of `prev_hash` followed by the entry's canonical JSON, computed independently outside the database. |
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
