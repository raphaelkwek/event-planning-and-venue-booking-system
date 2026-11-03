# EN-03-T6 — A transaction that fails after the append stores nothing

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T6 |
| Test Scenario | A transaction that fails after the append stores nothing |
| Category | Negative |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T6` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | A seeded Under Review event. Inside one transaction: F1's `APPROVE` transition, then an error thrown before the commit. |
| Expected Result | Nothing is stored: the event is still Under Review, and it has no new stream entry, no new `event_history` row and no new outbox message. |
| Acceptance criterion | Projections update in the same transaction as the append, together with the outbox row. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With an error thrown after the transition, the event stayed Under Review and had no stream entry, no history row and no outbox message. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStream.test.ts › the projections and the outbox (EN-03 criterion 2) › EN-03-T6 a transaction that fails after the append stores nothing, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
