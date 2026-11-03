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
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
