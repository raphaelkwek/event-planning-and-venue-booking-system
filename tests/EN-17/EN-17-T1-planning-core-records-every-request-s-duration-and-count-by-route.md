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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
