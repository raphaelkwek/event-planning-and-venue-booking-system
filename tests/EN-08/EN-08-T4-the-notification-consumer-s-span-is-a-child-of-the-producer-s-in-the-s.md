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
| Actual Result | The notification consumer's CONSUMER span was a child of the producer span in the header, in one trace, with its transaction and queries below it; with no header it continued from the CloudEvent's traceparent; a failing message was retried under a PRODUCER span that was a child of the consumer span; the Temporal worker's two consumers did the same. |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: d62134e7c97989aff7b8cce0e362cb7a7af7f605 · Evidence: backend/packages/telemetry/tests/kafka.test.ts › EN-08-T4 makes the consumer span a child of the producer span named in the header, in the same trace; backend/packages/telemetry/tests/kafka.test.ts › EN-08-T4 falls back to the CloudEvent's own traceparent when a message has no header; backend/packages/telemetry/tests/kafka.test.ts › EN-08-T4 starts a new trace for a message that names no usable parent; backend/packages/telemetry/tests/kafka.test.ts › EN-08-T4 marks the span failed and rethrows when the handler throws; backend/services/planning-core/tests/temporal/consumersTrace.unit.test.ts › EN-08-T4 handle an event-topic message in a CONSUMER span, a child of the traceparent in its header; backend/services/planning-core/tests/temporal/consumersTrace.unit.test.ts › EN-08-T4 handle a venue-booking message in a CONSUMER span, a child of the traceparent in its header; backend/services/notification/tests/consumer/consumeTraced.unit.test.ts › EN-08-T4 handles a message in a CONSUMER span that is a child of the producer's, with its queries below it; backend/services/notification/tests/consumer/consumeTraced.unit.test.ts › EN-08-T4 keeps a failing message in its trace: the retry is a PRODUCER span under the consumer span, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41611569860 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
