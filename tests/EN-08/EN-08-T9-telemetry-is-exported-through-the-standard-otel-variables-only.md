# EN-08-T9 — Telemetry is exported through the standard OTEL_* variables only

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T9 |
| Test Scenario | Telemetry is exported through the standard OTEL_* variables only |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`.<br>2. Find the tests whose names start `EN-08-T9`, in `backend/packages/telemetry/tests/env.test.ts` and `sdk.test.ts`. |
| Test Data | A local HTTP server standing in for Grafana Cloud's OTLP gateway, and `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`, `OTEL_SERVICE_NAME` and `OTEL_RESOURCE_ATTRIBUTES=deployment.environment=...`. |
| Expected Result | Spans arrive at `<endpoint>/v1/traces` and metrics at `<endpoint>/v1/metrics`, as protobuf, with the configured `Authorization` header and a resource that carries the service name and `deployment.environment`. A signal with only its own endpoint set is the only one sent; `OTEL_TRACES_EXPORTER=none` or `OTEL_METRICS_EXPORTER=none` turns one off. |
| Acceptance criterion | Exported only through the standard OTEL_* variables; with none set the SDK exports nothing and adds no startup errors or noise (the design in the EN-08 brief). |
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
