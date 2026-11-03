# EN-08-T6 — The correlation id is the trace id

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T6 |
| Test Scenario | The correlation id is the trace id |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. The approval's part needs the database, as card T11. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`, and `npm run test:coverage -w @connectsphere/planning-core` for the approval.<br>2. Find the tests whose names start `EN-08-T6`, in `backend/packages/telemetry/tests/http.test.ts`, `httpWithoutSdk.test.ts` and `backend/services/planning-core/tests/shared/d4Trace.test.ts`. |
| Test Data | Requests with no headers; with a W3C `traceparent`; with an `x-correlation-id` of the caller's own; and a process with no SDK running. |
| Expected Result | The response's `x-correlation-id` is the trace id of the request's server span (32 hex characters). An incoming `traceparent` is continued: the id is that trace's, and the server span is its child. A caller's own `x-correlation-id` is kept as a span attribute but is not the correlation id. The outbox message written by the request carries the same id as `correlationid`. With no SDK running, a caller's id is kept and otherwise a UUID is made, as before. |
| Acceptance criterion | The correlation id is the trace id. |
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
