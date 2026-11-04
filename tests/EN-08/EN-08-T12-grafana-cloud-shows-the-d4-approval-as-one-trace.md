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
| Actual Result | Run against staging (d1e6c08, deployed by the Release workflow with the OTEL settings of #114) instead of a laptop's `npm run dev`, with Joash's Grafana Cloud stack. As `coordinator@connectsphere.test`, an event assigned to that coordinator was opened (Under Review) and approved through the API (`POST /event/api/v1/events/:id/approve` → 200, Approved); its `x-correlation-id` was `a82bfe6d7c1bd4bc00d597a94ff1ac66`. In Grafana Explore, Tempo (`grafanacloud-wiselasagna1171-traces`), that trace id opened one trace: 38 spans, 4 services, root `planning-core POST /api/v1/events/:id/approve` (200, 2.54 s), under it two `db.transaction` spans with their queries (`SELECT identity.users`, `SELECT event.events`, `INSERT event.outbox`), three `connectsphere.event.v1 publish` spans, and under them `connectsphere.event.v1 process` in `notification` (with its `db.transaction`, `INSERT notification.notifications`), in `registration` and in `planning-core-worker`. Every resource carries `deployment.environment=staging`. |
| Status | Pass |
| Remarks | Commit: d1e6c08 · Evidence: `documentation/evidence/EN-08/EN-08-T12-grafana-trace-2026-11-04.png` (Joash's screenshot of the trace in Grafana) · Defect: — · The approval in step 1 was made through the API by a script signed in as the coordinator, not by clicking Approve in the browser; steps 2 and 3 were done by Joash in Grafana. |
| Executed By | Joash |
| Date of Execution | 2026-11-04 |
