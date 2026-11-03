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
| Actual Result | The script check passed 7 of 7 tests. It found at least 11 alerts, each with a runbook_url ending in /documentation/runbooks/<alert>.md, an existing runbook with the five required headings (Symptoms, First checks, Mitigation, Escalation, Dashboards) and an existing dashboard that the runbook links; every runbook belonged to an alert; every recording and alert rule queried only known metrics; and every dashboard parsed as JSON with a unique uid and title, at least one panel, a query on every panel and only known metrics. |
| Status | Pass |
| Remarks | Automated (script check in CI) · Commit: a74ca8b · Evidence: documentation/scripts/check-observability.test.ts › EN-17-T10 every alert has a runbook with the required sections; EN-17-T10 there is no runbook without an alert; EN-17-T10 rules query only known metrics; EN-17-T10 every dashboard is valid JSON with a uid and panels, and queries only known metrics, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41601054398, job Observability (promtool, dashboards, runbooks) · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
