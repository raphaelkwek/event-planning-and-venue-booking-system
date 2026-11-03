# EN-17-T9 — Over-admission and missing-metrics alerts fire

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T9 |
| Test Scenario | Over-admission and missing-metrics alerts fire |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Run promtool test rules on invariants.test.yml. |
| Test Data | A gauge series at 0, then 1; an `up` series at 0 for 6 minutes. |
| Expected Result | RegistrationOverAdmission fires at the first non-zero sample and not before; ServiceMetricsMissing stays quiet after 3 minutes of up == 0 and fires after 5 (the rule's `for: 5m`, as in documentation/slos.md). |
| Created By | Joash |
| Date of Creation | 2026-11-02 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | promtool test rules ran invariants.test.yml and printed SUCCESS. With the over-admission gauge at 0 0 0 then 1, RegistrationOverAdmission was quiet at 2m and fired at 3m, the first non-zero sample. With registration's up at 1 1 then 0, ServiceMetricsMissing was quiet at 5m (3 minutes of zeros) and fired at 8m (6 minutes) naming job connectsphere-registration; notification's healthy target did not fire. |
| Status | Pass |
| Remarks | Automated (promtool in CI) · Commit: c3ef046 · Evidence: observability/prometheus/tests/invariants.test.yml › over-admission and target-down cases, run by .github/workflows/ci.yml › job Observability (promtool, dashboards, runbooks) › step promtool test rules · CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41609228639 · The card's window was corrected from 10 to 5 minutes in c3ef046 to match the rule's for: 5m and documentation/slos.md · Defect: none |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
