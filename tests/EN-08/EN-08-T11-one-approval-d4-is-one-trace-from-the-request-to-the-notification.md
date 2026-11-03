# EN-08-T11 — One approval (D4) is one trace, from the request to the notification

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T11 |
| Test Scenario | One approval (D4) is one trace, from the request to the notification |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. `DATABASE_URL` points at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres; never the team's shared database.<br>3. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job does).<br>2. Find the test named `EN-08-T11 ...` in `backend/services/planning-core/tests/shared/d4Trace.test.ts`. |
| Test Data | An event under review and `POST /api/v1/events/:id/approve` as its coordinator, against the real database. The outbox relay publishes the row to a recording publisher, and the notification service's consumer handles that message against the real `notification` schema. |
| Expected Result | One trace: a SERVER span `POST /api/v1/events/:id/approve` with `http.route`; under it a `db.transaction` span holding `INSERT event.event_history` and `INSERT event.outbox`; under that the relay's PRODUCER span, whose traceparent is on the Kafka message; under that the notification service's CONSUMER span and its own `db.transaction` with `INSERT notification.consumed_messages` and `INSERT notification.notifications`. The response's `x-correlation-id`, the log line's `traceId`, and the outbox message's `correlationid` are all that trace's id, and the notification is stored. |
| Acceptance criterion | A Grafana trace shows one approval (D4, POST approve) end to end. (The span tree, asserted against the SDK's in-memory exporter in CI.) |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Against the real database: one trace with the SERVER span `POST /api/v1/events/:id/approve`, its db.transaction holding INSERT event.event_history and INSERT event.outbox, the relay's PRODUCER span under it, the notification CONSUMER span under that with its own transaction and the two notification inserts; x-correlation-id, the log line's traceId and the outbox correlationid were that trace's id; the notification was stored. |
| Status | Pass |
| Remarks | Automated (API level, CI; the database is Postgres) · Commit: d62134e7c97989aff7b8cce0e362cb7a7af7f605 · Evidence: backend/services/planning-core/tests/shared/d4Trace.test.ts › EN-08-T11 runs from the HTTP request, through the transaction and the outbox relay, into the notification consumer, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41611569860 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
