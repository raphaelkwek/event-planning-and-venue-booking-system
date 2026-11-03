# EN-17-T1 — planning-core records every request's duration and count by route

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T1 |
| Test Scenario | planning-core records every request's duration and count by route |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Build the metrics middleware.<br>2. Send a matched GET, a matched POST that answers 500, and an unknown path.<br>3. Read /metrics. |
| Test Data | A fake router with one GET and one failing POST route. |
| Expected Result | http_request_duration_seconds and http_requests_total carry the service name, method, route pattern and status class; the route label is the pattern (not the raw URL with ids); an unknown path is labelled unmatched. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Observability package: with the metrics middleware on a fake router, two GETs of different ids were counted under the route pattern /api/v1/things/:id (2xx, service planning-core, count 2), the POST that answered 500 under /api/v1/things (5xx, count 1) and an unknown path as unmatched (4xx, count 1); a router mounted under a prefix kept its full pattern; no raw id appeared in /metrics; the duration histogram carried the service, method, route and status labels with buckets and a count. planning-core: after /healthz and an unknown path, /metrics showed /healthz once as 2xx and unmatched once as 4xx, with the duration histogram present. |
| Status | Pass |
| Remarks | Automated (unit) · Commit: a74ca8b · Evidence: backend/packages/observability/tests/metrics.unit.test.ts › EN-17-T1 records a matched GET, a failing POST and an unknown path (7 of 7 tests in the file passed), and backend/services/planning-core/tests/shared/metrics.unit.test.ts › EN-17-T1 /metrics shows duration and count for a route that answered, and for an unknown path (1 of 1), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Lint, typecheck, build, unit tests · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
