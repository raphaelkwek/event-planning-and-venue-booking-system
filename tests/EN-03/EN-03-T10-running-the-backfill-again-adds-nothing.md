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
| Actual Result | The first run copied 4, the second copied 0, and the event's four entries were unchanged; the chain verified. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStream.test.ts › the backfill of the history written before the stream (EN-03 criterion 3) › EN-03-T10 running the backfill again adds nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
