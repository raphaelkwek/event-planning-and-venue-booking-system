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
| Actual Result | promtool test rules ran availability.test.yml, invariants.test.yml, notification_freshness.test.yml, registration_latency.test.yml and staff_api_latency.test.yml and printed SUCCESS for all five. For each of the four SLOs (availability, registration latency, staff API latency, notification freshness) the files assert that a total outage fires both the fast and the slow burn alert at 65 minutes; a steady 8x burn fires the slow alert only at 400 minutes; half the budget spent steadily fires neither at 400 minutes; and a burst that has recovered fires the fast alert at 55 minutes but no longer at 68 minutes. |
| Status | Pass |
| Remarks | Automated (promtool in CI) · Commit: a74ca8b · Evidence: observability/prometheus/tests/availability.test.yml, registration_latency.test.yml, staff_api_latency.test.yml and notification_freshness.test.yml › EN-17-T8 cases (total outage, steady 8x burn, half the budget, recovered burst), run by .github/workflows/ci.yml › job Observability (promtool, dashboards, runbooks) › step promtool test rules, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
