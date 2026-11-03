# EN-08-T5 — The registration consumer's span is a child of the producer's, in the same trace

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T5 |
| Test Scenario | The registration consumer's span is a child of the producer's, in the same trace |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test:unit -w @connectsphere/registration`.<br>2. Find the tests whose names start `EN-08-T5`, in `backend/services/registration/tests/consumer/consumeTraced.unit.test.ts`. |
| Test Data | A `venue-booking.request-approved` message published under a producer span, delivered with its `traceparent` header; the same message with no header. |
| Expected Result | The seat builder handles the approval in a CONSUMER span that is a child of the producer span in the header, in the approval's trace. With no header it continues from the CloudEvent's own `traceparent`. |
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
