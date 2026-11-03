# EN-08-T12 — Grafana Cloud shows the D4 approval as one trace

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-08-T12 |
| Test Scenario | Grafana Cloud shows the D4 approval as one trace |
| Pre-conditions | 1. A Grafana Cloud free-tier stack exists and `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS` are set in the private `.env` as `documentation/observability.md` describes (Joash creates the account).<br>2. Standard environment running (`npm run dev`) and test data reset (`tests/README.md`).<br>3. An event the Event Coordinator can approve (the D4 fixtures). |
| Test Steps | 1. Sign in as the assigned Event Coordinator and approve the event (D4).<br>2. Open Grafana, Explore, the Tempo data source, and search for the response's `x-correlation-id` as the trace id.<br>3. Open the trace and read its span tree. Screenshot it into `documentation/evidence/EN-08/`. |
| Test Data | The `x-correlation-id` header of the approve response (browser developer tools, Network). |
| Expected Result | One trace from `planning-core`: `POST /api/v1/events/:id/approve`, its `db.transaction` and queries, the `connectsphere.event.v1 publish` span, and under it `connectsphere.event.v1 process` from the `notification` service with its transaction. The services are named `planning-core` and `notification`, and the resource carries `deployment.environment`. |
| Acceptance criterion | A Grafana trace shows one approval (D4, POST approve) end to end. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: · Waits on the Grafana Cloud account Joash creates; the span tree in CI (EN-08-T11) is the automated half. Screenshot to follow in `documentation/evidence/EN-08/`. |
| Executed By |  |
| Date of Execution |  |
