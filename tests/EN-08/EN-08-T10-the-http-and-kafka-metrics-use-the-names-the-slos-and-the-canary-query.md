# EN-08-T10 — The HTTP and Kafka metrics use the names the SLOs and the canary query

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T10 |
| Test Scenario | The HTTP and Kafka metrics use the names the SLOs and the canary query |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`.<br>2. Find the tests whose names start `EN-08-T10`, in `backend/packages/telemetry/tests/http.test.ts`, `kafka.test.ts` and `sdk.test.ts`, and the retry-worker one in `backend/services/notification/tests/consumer/consumeTraced.unit.test.ts`. |
| Test Data | Requests to a route that fails and one that succeeds; Kafka messages handled with different outcomes and a broker timestamp 1.5 s old. |
| Expected Result | `http_request_duration_seconds` (unit seconds, buckets that include 0.4 and 0.8) and `http_requests_total` are recorded by `service`, `method`, `route` (the pattern, never the URL) and `status` (`2xx`, `4xx`, `5xx`), exactly the series EN-17 and EN-16 query. Kafka consumers record `kafka_consumer_processing_duration_seconds` by topic, group and outcome and `kafka_consumer_lag_seconds` (the notification retry worker's counted from when the retry was due, not from when it was queued). The metrics reach the OTLP endpoint. |
| Acceptance criterion | The metrics emitted are the ones EN-17's SLOs and EN-16's canary analysis query (documentation/slos.md, deploy/k8s/analysis/error-rate-and-p95.yaml). |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | http_request_duration_seconds (unit s, buckets including 0.4 and 0.8) and http_requests_total were recorded by service, method, route pattern and status class; the Kafka consumer recorded processing time by outcome and lag from the broker timestamp; the retry worker's lag counted from when the retry was due; the metrics reached the OTLP receiver. |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: f06a99244e8fbf21796f2af5b1a7865fbc4d1277 · Evidence: backend/packages/telemetry/tests/http.test.ts › EN-08-T10 record http_request_duration_seconds and http_requests_total with EN-17's labels; backend/packages/telemetry/tests/http.test.ts › EN-08-T10 count request durations in buckets that include 0.4 s and 0.8 s, the objectives; backend/packages/telemetry/tests/kafka.test.ts › EN-08-T10 records processing time by outcome and lag from the broker's timestamp; backend/services/notification/tests/consumer/consumeTraced.unit.test.ts › EN-08-T10 counts the retry worker's lag from when the retry was due, not from when it was queued, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41638243222 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
