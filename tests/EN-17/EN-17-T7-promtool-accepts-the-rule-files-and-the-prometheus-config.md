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
| Actual Result | In CI's Observability job, with prom/prometheus:v2.55.1, promtool check rules on observability/prometheus/rules/recording.yml and alerts.yml (the only two rule files) printed SUCCESS (16 rules found, then 11), and promtool check config --syntax-only on observability/prometheus/prometheus.yml printed that it is a valid prometheus config file syntax. Both steps passed. The config check ran with --syntax-only because the config names credentials files that exist only where Prometheus runs, so it did not open them. |
| Status | Pass |
| Remarks | Automated (promtool in CI) · Commit: a74ca8b · Evidence: .github/workflows/ci.yml › job Observability (promtool, dashboards, runbooks) › steps promtool check rules and promtool check config, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
