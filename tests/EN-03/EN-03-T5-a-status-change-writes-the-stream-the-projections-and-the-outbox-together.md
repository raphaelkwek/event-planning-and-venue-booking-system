# EN-03-T5 — A status change writes the stream entry, the projections and the outbox message in one transaction

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T5 |
| Test Scenario | A status change writes the stream entry, the projections and the outbox message in one transaction |
| Category | Happy path |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T5` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | A seeded Under Review event. A coordinator approves it through F1's transition (`APPROVE`). |
| Expected Result | After the commit: the event's row shows Approved; the stream holds a status-change entry Under Review → Approved with the coordinator, their role and the action; `event_history` holds a row with the same id and the same values; and the outbox holds one `event.status-changed` message for the event. All four were written by the one transaction. |
| Acceptance criterion | Projections update in the same transaction as the append, together with the outbox row. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After APPROVE the event was Approved; the stream held Under Review → Approved with the coordinator, role and action; event_history held a row with the same id and values; one event.status-changed outbox message existed. The events row, stream entry, history row and outbox row had the same xmin (one transaction). |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStream.test.ts › the projections and the outbox (EN-03 criterion 2) › EN-03-T5 a status change writes the stream entry, the projections and the outbox message in one transaction, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
