# EN-17-T10 — Every alert has a runbook and every dashboard is valid and uses emitted metrics

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-17-T10 |
| Test Scenario | Every alert has a runbook and every dashboard is valid and uses emitted metrics |
| Pre-conditions | Dependencies installed (`npm ci`). No database, Kafka or Prometheus server is needed unless the steps say so. |
| Test Steps | 1. Run `npx tsx --test documentation/scripts/check-observability.test.ts`. |
| Test Data | The files under observability/ and documentation/runbooks/. |
| Expected Result | Each alert has a runbook_url naming an existing documentation/runbooks/<alert>.md that has the five required headings; each dashboard parses as JSON, has a uid and panels, and only queries metrics that the services emit or the recording rules define. |
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
