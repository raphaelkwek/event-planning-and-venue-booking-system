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
| Actual Result | From a VM address 20.1.2.3 the API hosts were `api.staging.20.1.2.3.sslip.io` and `api.20.1.2.3.sslip.io`, and under a DuckDNS name `api.staging.connectsphere-x.duckdns.org`, with different container ports for the two environments. The host Caddyfile routed each host to its own container only (127.0.0.1:7861 and :7862, two reverse_proxy lines). The container's env file held the five Supabase values, `CORS_ALLOWED_ORIGINS` set to the environment's own web origin, `REDPANDA_MEMORY=512M` (and TRUST_PROXY_HOPS), and a value with a line break was refused (`SUPABASE_ANON_KEY contains a line break`). |
| Status | Pass |
| Remarks | Automated (script test, node:test) · Commit: 5cd14bb · Evidence: `deploy/azure/deploy-vm.test.mjs` › DEPLOY-T19 each environment gets its own API host on the VM's address, or under a DuckDNS name; `deploy/azure/deploy-vm.test.mjs` › DEPLOY-T19 the host Caddy routes each host to its own environment's container only; `deploy/azure/deploy-vm.test.mjs` › DEPLOY-T19 the container's env file holds the Space values, its own web origin for CORS, and a smaller Redpanda, CI run https://github.com/joass1/event-planning-and-venue-booking-system/actions/runs/41793114951 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-04 |
