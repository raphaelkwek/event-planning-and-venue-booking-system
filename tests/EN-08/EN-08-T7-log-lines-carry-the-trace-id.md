# EN-08-T7 — Log lines carry the trace id

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T7 |
| Test Scenario | Log lines carry the trace id |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry` and `npm run test:unit -w @connectsphere/notification`.<br>2. Find the tests whose names start `EN-08-T7`, in `backend/packages/telemetry/tests/traceContext.test.ts` and `backend/services/notification/tests/consumer/consumeTraced.unit.test.ts`. |
| Test Data | A log line written inside a span; one outside any span; one that already names a correlation id. |
| Expected Result | Inside a span a line has `traceId` and `spanId`, and `correlationId` is the trace id unless the caller gave one. Outside a span the line is unchanged. The notification consumer's `notifications stored` line, written while it handles a message, carries the producer's trace id; planning-core's `request completed` line carries the request's. |
| Acceptance criterion | The correlation id is the trace id. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Inside a span a log line had traceId, spanId and a correlationId equal to the trace id unless the caller gave one; outside a span it was unchanged; the notification consumer's `notifications stored` line carried the producer's trace id. |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: d62134e7c97989aff7b8cce0e362cb7a7af7f605 · Evidence: backend/packages/telemetry/tests/traceContext.test.ts › EN-08-T7 puts the trace id on a log line as traceId, and as correlationId when the caller gave none; backend/services/notification/tests/consumer/consumeTraced.unit.test.ts › EN-08-T7 logs what it did inside the span, so the line carries the trace id; backend/services/planning-core/tests/shared/d4Trace.test.ts › EN-08-T11 runs from the HTTP request, through the transaction and the outbox relay, into the notification consumer, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41611569860 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
