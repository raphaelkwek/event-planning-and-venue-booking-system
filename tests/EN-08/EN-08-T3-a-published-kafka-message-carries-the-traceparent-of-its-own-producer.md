# EN-08-T3 — A published Kafka message carries the traceparent of its own producer span

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T3 |
| Test Scenario | A published Kafka message carries the traceparent of its own producer span |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry` and `npm run test:unit -w @connectsphere/planning-core`.<br>2. Find the tests whose names start `EN-08-T3`, in `backend/packages/telemetry/tests/kafka.test.ts` and `backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts`. |
| Test Data | Outbox rows whose CloudEvent `traceparent` names the transaction that wrote them; a publisher that records what it is given, or that fails. |
| Expected Result | The relay publishes each message under its own PRODUCER span, a child of the transaction in that row's traceparent, and the Kafka message's `traceparent` header names that producer span, in the originating trace. The CloudEvent payload is unchanged. A failed send marks every span of the batch as an error and leaves the rows pending. A row that can never be published makes no span. An outbox row is written with the active span's traceparent, or a new valid one when there is none. |
| Acceptance criterion | The W3C traceparent is carried in Kafka message headers, so a trace continues into the notification and registration services. |
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
