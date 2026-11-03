# EN-08-T10 — The HTTP and Kafka metrics use the names the SLOs and the canary query

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T10 |
| Test Scenario | The HTTP and Kafka metrics use the names the SLOs and the canary query |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`.<br>2. Find the tests whose names start `EN-08-T10`, in `backend/packages/telemetry/tests/http.test.ts`, `kafka.test.ts` and `sdk.test.ts`. |
| Test Data | Requests to a route that fails and one that succeeds; Kafka messages handled with different outcomes and a broker timestamp 1.5 s old. |
| Expected Result | `http_request_duration_seconds` (unit seconds, buckets that include 0.4 and 0.8) and `http_requests_total` are recorded by `service`, `method`, `route` (the pattern, never the URL) and `status` (`2xx`, `4xx`, `5xx`), exactly the series EN-17 and EN-16 query. Kafka consumers record `kafka_consumer_processing_duration_seconds` by topic, group and outcome and `kafka_consumer_lag_seconds`. The metrics reach the OTLP endpoint. |
| Acceptance criterion | The metrics emitted are the ones EN-17's SLOs and EN-16's canary analysis query (documentation/slos.md, deploy/k8s/analysis/error-rate-and-p95.yaml). |
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
