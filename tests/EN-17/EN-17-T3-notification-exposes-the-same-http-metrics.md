# EN-17-T3 — Notification exposes the same HTTP metrics

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T3 |
| Test Scenario | Notification exposes the same HTTP metrics |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Mount the notification app.<br>2. Request /healthz.<br>3. Read /metrics. |
| Test Data | The notification app with a stubbed database. |
| Expected Result | /metrics shows http_requests_total for service=notification. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The notification app answered /healthz, then /metrics answered 200 and showed http_requests_total for GET /healthz, 2xx, service notification, with a count of 1. |
| Status | Pass |
| Remarks | Automated (unit) · Commit: a74ca8b · Evidence: backend/services/notification/tests/metrics.unit.test.ts › EN-17-T3 /metrics shows the HTTP metrics (3 of 3 tests in the file passed), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Lint, typecheck, build, unit tests · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
