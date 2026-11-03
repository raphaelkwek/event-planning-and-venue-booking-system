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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
