# EN-17-T8 — Each burn-rate alert fires when its burn rate is exceeded and stays quiet below it

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T8 |
| Test Scenario | Each burn-rate alert fires when its burn rate is exceeded and stays quiet below it |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Run `promtool test rules observability/prometheus/tests/*.yml`.<br>2. Each file feeds synthetic series and asserts the alerts at chosen times. |
| Test Data | Synthetic series for registration latency, staff API latency, notification freshness and availability: a fast burn, a slow burn, a healthy run, and a short blip. |
| Expected Result | Fast-burn alerts fire when both the 1h and 5m windows exceed 14.4x; slow-burn alerts when both 6h and 30m exceed 6x; neither fires on a healthy run, and a blip that clears the short window does not fire the fast alert. |
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
