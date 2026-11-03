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
| Remarks | Commit: · Evidence: Not run: EN-17 has not merged and there is no staging cluster. The demonstration uses a stand-in service that exposes the same names. · Defect: |
| Executed By |  |
| Date of Execution |  |
