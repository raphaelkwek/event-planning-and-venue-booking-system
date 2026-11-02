# EN-17-T9 — Over-admission and missing-metrics alerts fire

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T9 |
| Test Scenario | Over-admission and missing-metrics alerts fire |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Run promtool test rules on invariants.test.yml. |
| Test Data | A gauge series at 0, then 1; an `up` series at 0 for 10 minutes. |
| Expected Result | RegistrationOverAdmission fires at the first non-zero sample and not before; ServiceMetricsMissing fires after 10 minutes of up == 0. |
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
