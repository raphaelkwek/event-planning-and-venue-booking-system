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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
