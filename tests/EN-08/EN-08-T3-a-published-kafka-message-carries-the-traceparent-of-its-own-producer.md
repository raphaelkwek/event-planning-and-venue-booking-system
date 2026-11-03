# EN-08-T3 — A published Kafka message carries the traceparent of its own producer span

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T3 |
| Test Scenario | A published Kafka message carries the traceparent of its own producer span |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry` and `npm run test:unit -w @connectsphere/planning-core`.<br>2. Find the tests whose names start `EN-08-T3`, in `backend/packages/telemetry/tests/kafka.test.ts`, `backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts` and `backend/services/registration/tests/outbox/relayTrace.unit.test.ts`. |
| Test Data | Outbox rows whose CloudEvent `traceparent` names the transaction that wrote them; a publisher that records what it is given, or that fails. |
| Expected Result | Planning-core's and registration's outbox relays publish each message under their own PRODUCER spans, a child of the transaction in that row's traceparent, and the Kafka message's `traceparent` header names that producer span, in the originating trace. The CloudEvent payload is unchanged. A failed send marks every span of the batch as an error and leaves the rows pending. A row that can never be published makes no span. An outbox row (either service's) is written with the active span's traceparent, or a new valid one when there is none. |
| Acceptance criterion | The W3C traceparent is carried in Kafka message headers, so a trace continues into the notification and registration services. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Planning-core's and registration's relays sent each message under their own PRODUCER spans, a child of the transaction in its row's traceparent, with that span's traceparent in the Kafka header; the payload and content type were unchanged; a failed send marked the spans as errors and left the row pending; an unpublishable row made no span; an outbox row took the active span's traceparent. |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: f06a99244e8fbf21796f2af5b1a7865fbc4d1277 · Evidence: backend/packages/telemetry/tests/kafka.test.ts › EN-08-T3 gives each message its own PRODUCER span, a child of the transaction in its own traceparent, and that span's traceparent as the header; backend/packages/telemetry/tests/kafka.test.ts › EN-08-T3 makes the publish a child of the active span when it is not told to continue a header (a consumer's retry); backend/packages/telemetry/tests/kafka.test.ts › EN-08-T3 marks every span of a failed send as an error, rethrows, and counts the failure; backend/packages/telemetry/tests/kafka.test.ts › EN-08-T3 starts a new trace for a message whose header is missing or unusable; backend/packages/telemetry/tests/postgres.test.ts › EN-08-T3 makes the transaction the active span inside it, so an outbox row carries its traceparent; backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts › EN-08-T3 sends each message with the traceparent of its own PRODUCER span, a child of the transaction that wrote the row; backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts › EN-08-T3 keeps the CloudEvent's own traceparent in the payload, and the content type header; backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts › EN-08-T3 marks the producer spans failed when the broker refuses, and leaves the row pending; backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts › EN-08-T3 makes no span for a row that can never be published; backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts › EN-08-T3 gives a row written with no active span a new valid traceparent, so the relay still publishes one; backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts › EN-08-T3 is the active span's, so the message belongs to the request that caused it; backend/services/registration/tests/outbox/relayTrace.unit.test.ts › EN-08-T3 sends each message with the traceparent of its own PRODUCER span, a child of the transaction that wrote the row; backend/services/registration/tests/outbox/relayTrace.unit.test.ts › EN-08-T3 marks the producer span failed when the broker refuses; backend/services/registration/tests/outbox/relayTrace.unit.test.ts › EN-08-T3 writes a row with the active span's traceparent, or a new valid one when there is none, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41638243222 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
