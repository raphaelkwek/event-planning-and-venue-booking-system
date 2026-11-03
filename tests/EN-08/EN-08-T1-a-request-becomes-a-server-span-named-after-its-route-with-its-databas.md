# EN-08-T1 — A request becomes a server span named after its route, with its database queries as children

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T1 |
| Test Scenario | A request becomes a server span named after its route, with its database queries as children |
| Pre-conditions | 1. Dependencies installed (`npm ci`).<br>2. Run from the repository root. No database, Kafka broker, collector or Grafana account is needed: the database is an address that refuses connections, Kafka is a stand-in, and the OTLP receiver is a local HTTP server. |
| Test Steps | 1. Run `npm run test -w @connectsphere/telemetry`.<br>2. Find the tests whose names start `EN-08-T1`, in `backend/packages/telemetry/tests/http.test.ts`. |
| Test Data | An Express app with the telemetry middleware and a route `GET /things/:id` that runs one query against a database whose address refuses connections; also `/ok`, `/healthz` and a path no route matches. |
| Expected Result | `GET /things/42` makes one SERVER span named `GET /things/:id` (not the raw URL) with `http.route` set, and the query's span is its child in the same trace. A health probe makes no trace. A path no route matches keeps the plain name `GET` and sets no `http.route`, so a scan cannot create span names. |
| Acceptance criterion | The services are instrumented: HTTP/Express, postgres.js (manual spans or a wrapped query helper) and kafkajs. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | A request to GET /things/:id made a SERVER span named `GET /things/:id` with `http.route` set, and the query's span was its child in the same trace; a health probe made no trace; an unmatched path kept the plain name `GET` and no `http.route`. The same on the real approve route (T11). |
| Status | Pass |
| Remarks | Automated (unit tests, CI) · Commit: f06a99244e8fbf21796f2af5b1a7865fbc4d1277 · Evidence: backend/packages/telemetry/tests/http.test.ts › EN-08-T1 makes a server span named after its route pattern, with the database query as its child; backend/packages/telemetry/tests/http.test.ts › EN-08-T1 makes no trace for a health probe; backend/packages/telemetry/tests/http.test.ts › EN-08-T1 leaves an unmatched route's span with its plain name, so a scan cannot create span names, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41638243222 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
