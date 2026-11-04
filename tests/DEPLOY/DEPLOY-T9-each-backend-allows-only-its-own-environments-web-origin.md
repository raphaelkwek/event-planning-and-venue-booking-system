# DEPLOY-T9 — Each backend allows its own environment's web origin only

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T9 |
| Test Scenario | Each backend allows its own environment's web origin only |
| Pre-conditions | 1. The unit tests of planning-core, registration and notification run.<br>2. The kind job's smoke test runs against the deployed overlay. |
| Test Steps | 1. Send a request and a preflight with `Origin` set to the origin in CORS_ALLOWED_ORIGINS.<br>2. Send the same with another origin.<br>3. Start with CORS_ALLOWED_ORIGINS unset.<br>4. Start with `*` or an origin with a path. |
| Test Data | None. |
| Expected Result | Step 1 gets `Access-Control-Allow-Origin` for that origin and exposes `X-Correlation-Id`; step 2 gets no such header; step 3 changes nothing; step 4 refuses to start. |
| Acceptance criterion | CORS: the backends allow the Vercel origin of their own environment only, read from env. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | In planning-core, registration and notification: the allowed origin got Access-Control-Allow-Origin and the exposed X-Correlation-Id, its preflight 204 with the methods and headers; a foreign origin got no such header; with CORS_ALLOWED_ORIGINS unset nothing changed; a wildcard or a path was refused at start-up. In kind the deployed services allowed the configured origin's preflight and not a foreign one. |
| Status | Pass |
| Remarks | Automated (unit and kind, CI) · Commit: f76866586a318aa5852f75edab518cb95ffd7690 · Evidence: backend/services/{planning-core/tests/shared,registration/tests,notification/tests}/cors.unit.test.ts › DEPLOY-T9 (five tests each); deploy/release/smoke-api.sh in job 'kind: k3s staging overlay (Redpanda, Temporal, Cerbos, Traefik)'; CI runs https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563224 and https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563160 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
