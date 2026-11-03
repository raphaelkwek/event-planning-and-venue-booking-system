# EN-08-T8 — With no OTLP endpoint nothing is exported and nothing is printed

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T8 |
| Test Scenario | With no OTLP endpoint nothing is exported and nothing is printed |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`.<br>2. Find the tests whose names start `EN-08-T8`, in `backend/packages/telemetry/tests/env.test.ts` and `sdk.test.ts`, and the one in `backend/services/planning-core/tests/shared/outboxRelayTrace.unit.test.ts` named for a row written with no active span. |
| Test Data | An environment with no `OTEL_*` variables; a blank endpoint; `OTEL_SDK_DISABLED=true` with an endpoint set. |
| Expected Result | With no endpoint no exporter is created, no HTTP request is made, and nothing is written to the console or stderr, yet trace ids, the correlation id and Kafka's traceparent still work. A collector that never answers cannot hold shutdown past its 5 s limit. `OTEL_SDK_DISABLED=true` installs nothing, even with an endpoint, and then no trace id exists, and a message written without an active span gets a random valid traceparent, as before. |
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
