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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
