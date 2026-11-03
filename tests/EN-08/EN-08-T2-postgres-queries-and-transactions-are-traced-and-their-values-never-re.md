# EN-08-T2 — Postgres queries and transactions are traced, and their values never reach a span

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T2 |
| Test Scenario | Postgres queries and transactions are traced, and their values never reach a span |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`.<br>2. Find the tests whose names start `EN-08-T2`, in `backend/packages/telemetry/tests/postgres.test.ts` and `http.test.ts`. |
| Test Data | A stand-in for the postgres.js pool, and a real postgres.js pool whose address refuses connections. A query with the value `secret-value`. |
| Expected Result | Each query that runs gets one CLIENT span, a child of the span active when it was written, named for its operation and table (`SELECT event.events`). Its text has `$1` where the value was: the value appears nowhere in the span. A transaction gets one `db.transaction` span and its queries (and a savepoint's) are its children. A failed query or rollback marks the span as an error with the SQLSTATE, and the caller still gets the error. A query made with no span around it (the outbox relay's polling, the readiness probe) makes no span. |
| Acceptance criterion | The services are instrumented: HTTP/Express, postgres.js (manual spans or a wrapped query helper) and kafkajs. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Queries became CLIENT spans named for their operation and table, children of the active span; the text had `$1` and the value `secret-value` appeared nowhere; a transaction made one `db.transaction` span with its (and a savepoint's) queries as children; failures were recorded with the SQLSTATE and rethrown; a query with no span around it made no span. |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: d62134e7c97989aff7b8cce0e362cb7a7af7f605 · Evidence: backend/packages/telemetry/tests/http.test.ts › EN-08-T2 records a statement's text with placeholders, never the values; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 puts $n where a value was, collapses whitespace and bounds the length; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 makes one CLIENT span per query that runs, a child of the span active when it was written; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 makes no span for a fragment that is only interpolated into another query; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 makes no span for a query with no span around it, such as the outbox relay's polling; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 passes helpers such as sql.json and values through unchanged; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 records a failed query as an error with Postgres's SQLSTATE, and the caller still gets the error; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 traces a query run with .catch or .finally, and ends its span once however often it is awaited; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 traces unsafe() with its statement text; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 wraps a transaction's queries in one db.transaction span and makes them its children; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 keeps a savepoint's queries under the transaction; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 marks the transaction failed and rethrows when it rolls back; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T2 keeps a transaction's queries under it even when the callback runs later, from another async context, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41611569860 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
