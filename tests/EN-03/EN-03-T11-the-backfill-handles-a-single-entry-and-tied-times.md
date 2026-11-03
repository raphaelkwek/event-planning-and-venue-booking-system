# EN-03-T11 — The backfill handles an event with one entry and entries recorded at the same time

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T11 |
| Test Scenario | The backfill handles an event with one entry and entries recorded at the same time |
| Category | Boundary |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T11` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | Event A: one pre-stream history row. Event B: three pre-stream rows with the same `occurred_at`, whose `created_at` values are a second apart, inserted in a different order from that. Event C: no history. |
| Expected Result | Event A's stream has one entry, version 1, whose `prev_hash` is the genesis value. Event B's three entries are versions 1 to 3 in `created_at` order, which is the order F2 listed tied entries in before EN-03, so the history screen's order does not change. Both chains verify. An event with no history has no stream entries. |
| Acceptance criterion | The existing A–E history (`event_history`) is migrated into the stream. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Event A had one entry, version 1 with the genesis prev_hash. Event B's three tied entries were versions 1–3 in created_at order. Event C had no entries. Both chains verified. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStream.test.ts › the backfill of the history written before the stream (EN-03 criterion 3) › EN-03-T11 the backfill handles an event with one entry and entries recorded at the same time, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
