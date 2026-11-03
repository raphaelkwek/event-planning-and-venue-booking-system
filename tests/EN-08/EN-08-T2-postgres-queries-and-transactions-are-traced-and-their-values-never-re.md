# EN-08-T2 — Postgres queries and transactions are traced, and their values never reach a span

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T2 |
| Test Scenario | Postgres queries and transactions are traced, and their values never reach a span |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`.<br>2. Find the tests whose names start `EN-08-T2`, in `backend/packages/telemetry/tests/postgres.test.ts` and `http.test.ts`. |
| Test Data | A stand-in for the postgres.js pool, and a real postgres.js pool whose address refuses connections. A query with the value `secret-value`. |
| Expected Result | Each query that runs gets one CLIENT span, a child of the span active when it was written, named for its operation and table (`SELECT event.events`). Its text has `$1` where the value was: the value appears nowhere in the span. A transaction gets one `db.transaction` span and its queries (and a savepoint's) are its children. A failed query or rollback marks the span as an error with the SQLSTATE and the error's class, never Postgres's message (which can echo a value), and the caller still gets the error. A statement run with `unsafe()` has its text recorded only if it was given parameters. A query made with no span around it (the outbox relay's polling, the readiness probe) makes no span. |
| Acceptance criterion | The services are instrumented: HTTP/Express, postgres.js (manual spans or a wrapped query helper) and kafkajs. |
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
