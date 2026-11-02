# EN-14-T8 — The services start and serve without Kafka, keeping their messages in the outbox

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-14-T8 |
| Test Scenario | The services start and serve without Kafka, keeping their messages in the outbox |
| Pre-conditions | CI's `e2e` job has run. Its Playwright config blanks every `KAFKA_*` variable. |
| Test Steps | 1. Open `planning-core.log`, `notification.log` and `registration.log` in `e2e-stack-logs`.<br>2. Note each readiness answer Playwright waited for. |
| Test Data | `KAFKA_BROKERS=` (blank). |
| Expected Result | planning-core logs that the outbox relay is not started, and notification and registration that their consumers are not started. Each answers `/readyz` with 200 and `kafka: not_configured`, and every journey runs. Nothing reaches the team's hosted Kafka cluster. |
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
