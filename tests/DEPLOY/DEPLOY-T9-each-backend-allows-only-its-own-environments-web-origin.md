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
| Actual Result | — |
| Status | Not Executed |
| Remarks | — |
| Executed By | — |
| Date of Execution | — |
