# EN-17-T7 — promtool accepts the rule files and the Prometheus config

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T7 |
| Test Scenario | promtool accepts the rule files and the Prometheus config |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Run `promtool check rules observability/prometheus/rules/*.yml`.<br>2. Run `promtool check config observability/prometheus/prometheus.yml`. |
| Test Data | The files in observability/prometheus/. |
| Expected Result | Both commands exit 0. |
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
