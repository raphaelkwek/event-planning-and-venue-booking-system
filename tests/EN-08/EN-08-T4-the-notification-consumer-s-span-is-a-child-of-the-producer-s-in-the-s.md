# EN-08-T4 — The notification consumer's span is a child of the producer's, in the same trace

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T4 |
| Test Scenario | The notification consumer's span is a child of the producer's, in the same trace |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`, `npm run test:unit -w @connectsphere/notification` and `npm run test:unit -w @connectsphere/planning-core`.<br>2. Find the tests whose names start `EN-08-T4`, in `backend/packages/telemetry/tests/kafka.test.ts`, `backend/services/notification/tests/consumer/consumeTraced.unit.test.ts` and, for the Temporal worker's two consumers, `backend/services/planning-core/tests/temporal/consumersTrace.unit.test.ts`. |
| Test Data | An `event.approved` message published under a producer span, delivered with its `traceparent` header as kafkajs delivers it (a Buffer); the same message with no header; one with an unusable one; a database that fails. |
| Expected Result | The consumer handles the message in a CONSUMER span that is a child of the producer span named in the header, in the same trace, and its transaction and queries are below it. With no header it continues from the CloudEvent's own `traceparent`; with neither usable it starts a new trace. A message that fails is retried under a PRODUCER span that is a child of the consumer span, with its own traceparent header, so the retry stays in the trace. The span records the group, partition and offset and its outcome. |
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
