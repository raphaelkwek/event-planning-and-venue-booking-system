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
| Actual Result | A local OTLP receiver got traces at /otlp/v1/traces and metrics at /otlp/v1/metrics as protobuf with the configured Authorization and X-Scope headers and a resource carrying the service name and deployment.environment; a signal with only its own endpoint was the only one sent; OTEL_*_EXPORTER=none switched one off. |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: f06a99244e8fbf21796f2af5b1a7865fbc4d1277 · Evidence: backend/packages/telemetry/tests/env.test.ts › EN-08-T9 exports both signals when the shared OTLP endpoint is set; backend/packages/telemetry/tests/env.test.ts › EN-08-T9 exports only the signal whose own endpoint is set; backend/packages/telemetry/tests/env.test.ts › EN-08-T9 turns one signal off with the standard OTEL_*_EXPORTER=none; backend/packages/telemetry/tests/sdk.test.ts › EN-08-T9 sends traces to <endpoint>/v1/traces with the OTEL_EXPORTER_OTLP_HEADERS and the resource attributes; backend/packages/telemetry/tests/sdk.test.ts › EN-08-T9 sends metrics to <endpoint>/v1/metrics, with the HTTP histogram EN-17 queries; backend/packages/telemetry/tests/sdk.test.ts › EN-08-T9 sends only the signal that has its own endpoint, and none that is switched off, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41638243222 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
