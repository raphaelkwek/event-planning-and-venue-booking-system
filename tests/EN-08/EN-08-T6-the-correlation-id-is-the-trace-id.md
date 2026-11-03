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
| Actual Result | The response's x-correlation-id was the server span's trace id (32 hex); an incoming traceparent was continued; a caller's own id was kept as a span attribute; the outbox message carried the same id as correlationid (T11); with no SDK the caller's id or a UUID was used. |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: d62134e7c97989aff7b8cce0e362cb7a7af7f605 · Evidence: backend/packages/telemetry/tests/http.test.ts › EN-08-T6 answers with the trace id as x-correlation-id; backend/packages/telemetry/tests/http.test.ts › EN-08-T6 continues an incoming traceparent: the correlation id is that trace's id; backend/packages/telemetry/tests/http.test.ts › EN-08-T6 keeps a caller's own x-correlation-id on the span, but the trace id is the correlation id; backend/packages/telemetry/tests/httpWithoutSdk.test.ts › EN-08-T6 keeps a caller's x-correlation-id, on the response and for the code that reads it; backend/packages/telemetry/tests/httpWithoutSdk.test.ts › EN-08-T6 makes a UUID when there is neither a trace nor a caller's id; backend/services/planning-core/tests/shared/d4Trace.test.ts › EN-08-T11 runs from the HTTP request, through the transaction and the outbox relay, into the notification consumer, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41611569860 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
