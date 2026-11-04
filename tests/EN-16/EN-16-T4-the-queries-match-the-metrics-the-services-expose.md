# EN-16-T4 — The AnalysisTemplate's queries return data against planning-core's real /metrics endpoint

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-16-T4 |
| Test Scenario | The AnalysisTemplate's queries return data against planning-core's real /metrics endpoint |
| Pre-conditions | 1. EN-17 merged, so planning-core exposes `/metrics` with `http_requests_total{status}` and `http_request_duration_seconds`.<br>2. A staging Prometheus scraping it. |
| Test Steps | 1. Run both queries from `deploy/k8s/analysis/error-rate-and-p95.yaml` in Prometheus for a planning-core pod.<br>2. Roll out a new planning-core build in staging and watch the AnalysisRun. |
| Test Data | Staging. |
| Expected Result | Both queries return a number for the canary's pods. |
| Acceptance criterion | The queries depend on EN-17's metric names (`http_request_duration_seconds`, `http_requests_total{status}`). |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Not run. Depends on EN-17 and a staging cluster. |
| Status | Not Executed |
| Remarks | Not run: the queries are those of the Argo Rollouts AnalysisTemplate (deploy/k8s/analysis/error-rate-and-p95.yaml), and neither deployed environment has Argo Rollouts or a Prometheus scraping a canary: since ADR-0016's amendment each environment is one container on the Azure VM, and its metrics go to Grafana Cloud (#114). EN-17 has merged, so the services do expose `http_requests_total` and `http_request_duration_seconds`; running the two queries in Grafana Cloud needs Joash's Grafana login. · Defect: — |
| Executed By |  |
| Date of Execution |  |
