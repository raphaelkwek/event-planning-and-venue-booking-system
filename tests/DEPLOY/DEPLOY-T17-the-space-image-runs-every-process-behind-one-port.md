# DEPLOY-T17 — The Hugging Face Space image runs every process behind one port, as a Space runs it

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T17 |
| Test Scenario | The Hugging Face Space image runs every process behind one port, as a Space runs it |
| Pre-conditions | 1. The Deploy workflow's `Space image` job runs. |
| Test Steps | 1. Write the Space repository with `deploy-space.mjs --context-only` and build its Dockerfile.<br>2. Run the image as uid 1000 with only the Space's settings, `DATABASE_URL` pointing at a closed port and `MIGRATE_DATABASE_URL` at the throwaway Postgres.<br>3. Wait for `/healthz` on 7860, then check the log, `/readyz` of each service, Cerbos, the worker and supervisord.<br>4. Run `deploy/release/smoke-api.sh` against port 7860 with the CORS origin. |
| Test Data | Throwaway Postgres on the runner, never Supabase. |
| Expected Result | start.sh fell back to the session pooler URL and ran the migrations first; every supervisord program is RUNNING; each service is ready with the database ok and Kafka reachable; the worker logged 'Temporal worker started'; Cerbos serves; through Caddy the API answers 401 envelopes, only `/healthz` and the API prefixes are routed, and CORS allows only the configured origin. |
| Acceptance criterion | One container per Space: the services, Redpanda (SASL), the Temporal dev server and Cerbos under a supervisor, with Caddy on the Space's one port routing the public prefixes; health and metrics internal; migrations at start against the session pooler. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Not Executed |
| Remarks | — |
| Executed By | — |
| Date of Execution | — |
