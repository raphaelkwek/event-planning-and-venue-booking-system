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
| Actual Result | The second append, started while the first was uncommitted, waited on the first and was then refused with "Another change to event … was recorded first, so this one was not stored." The event's stream held one entry (version 1, the first append's), one history row, and its chain verified. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStream.test.ts › the stream (EN-03 criterion 1) › EN-03-T3 two appends racing for the same version store exactly one, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
