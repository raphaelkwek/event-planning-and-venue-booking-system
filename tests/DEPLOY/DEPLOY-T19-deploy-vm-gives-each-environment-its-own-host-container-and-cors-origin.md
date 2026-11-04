# DEPLOY-T19 — deploy:vm gives each environment its own host, container and CORS origin

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T19 |
| Test Scenario | deploy:vm gives each environment its own host, container and CORS origin |
| Pre-conditions | 1. The unit tests run (`npm run test:scripts`). |
| Test Steps | 1. Work out the API host of each environment from a VM address, and under a DuckDNS name.<br>2. Write the host Caddyfile.<br>3. Write a container's env file, and one with a line break in a value. |
| Test Data | Made-up values built at run time. |
| Expected Result | Step 1 gives `api.staging.<ip>.sslip.io` and `api.<ip>.sslip.io` (or the same under the DuckDNS name) on different ports. Step 2 routes each host to its own container only. Step 3 holds the five Supabase values, the environment's own web origin as CORS_ALLOWED_ORIGINS, and REDPANDA_MEMORY=512M, and refuses the line break. |
| Acceptance criterion | One VM runs both environments, each in its own container with its own env file, behind a host Caddy routing by host. |
| Created By | Joash |
| Date of Creation | 2026-11-04 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | — |
| Status | Not Executed |
| Remarks | — |
| Executed By | — |
| Date of Execution | — |
