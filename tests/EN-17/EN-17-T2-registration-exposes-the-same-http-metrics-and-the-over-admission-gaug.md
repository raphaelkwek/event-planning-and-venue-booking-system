# EN-17-T2 — Registration exposes the same HTTP metrics and the over-admission gauge

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T2 |
| Test Scenario | Registration exposes the same HTTP metrics and the over-admission gauge |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Mount the registration app.<br>2. Request /healthz.<br>3. Read /metrics. |
| Test Data | The registration app with a stubbed database. |
| Expected Result | /metrics shows http_requests_total for service=registration and registration_over_admission_seats. |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The registration app answered /healthz, then /metrics answered 200 and showed http_requests_total for GET /healthz, 2xx, service registration, with a count of 1, and declared registration_over_admission_seats and registration_invariant_check_success as gauges. |
| Status | Pass |
| Remarks | Automated (unit) · Commit: a74ca8b · Evidence: backend/services/registration/tests/metrics.unit.test.ts › EN-17-T2 /metrics shows the HTTP metrics and the over-admission gauge (5 of 5 tests in the file passed), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Lint, typecheck, build, unit tests · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
