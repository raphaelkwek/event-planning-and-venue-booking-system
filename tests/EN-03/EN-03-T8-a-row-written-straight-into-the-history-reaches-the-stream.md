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
| Actual Result | A direct insert into event_history became stream version 2 with the row's id and values, chained to version 1. A status change without a new status was refused, by the history insert and by the append alike (not as a lost race), and stored nothing in either table. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStream.test.ts › the projections and the outbox (EN-03 criterion 2) › EN-03-T8 a history row written without the append function still reaches the stream, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
