# EN-08-T5 — The registration consumer's span is a child of the producer's, in the same trace

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T5 |
| Test Scenario | The registration consumer's span is a child of the producer's, in the same trace |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test:unit -w @connectsphere/registration`.<br>2. Find the tests whose names start `EN-08-T5`, in `backend/services/registration/tests/consumer/consumeTraced.unit.test.ts`. |
| Test Data | A `venue-booking.request-approved` message published under a producer span, delivered with its `traceparent` header; the same message with no header. |
| Expected Result | The seat builder handles the approval in a CONSUMER span that is a child of the producer span in the header, in the approval's trace, and the event-listings consumer does the same for the event topic. With no header it continues from the CloudEvent's own `traceparent`. |
| Acceptance criterion | The W3C traceparent is carried in Kafka message headers, so a trace continues into the notification and registration services. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The registration seat-builder's CONSUMER span (and the event-listings consumer's) was a child of the producer span in the header, in the approval's trace, and continued from the CloudEvent's traceparent when the header was absent. |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: f06a99244e8fbf21796f2af5b1a7865fbc4d1277 · Evidence: backend/services/registration/tests/consumer/consumeTraced.unit.test.ts › EN-08-T5 handles an approval in a CONSUMER span that is a child of the producer's, in the approval's trace; backend/services/registration/tests/consumer/consumeTraced.unit.test.ts › EN-08-T5 continues from the CloudEvent's own traceparent when the message has no header; backend/services/registration/tests/consumer/consumeTraced.unit.test.ts › EN-08-T5 handles a message in the event-listings consumer under a CONSUMER span as well, in the message's trace, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41638243222 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
