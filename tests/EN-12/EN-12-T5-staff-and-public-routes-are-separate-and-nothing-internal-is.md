# EN-12-T5 — Staff and public traffic use separate routes and upstream pools; health endpoints and unknown prefixes are not reachable

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T5 |
| Test Scenario | Staff and public traffic use separate routes and upstream pools; health endpoints and unknown prefixes are not reachable |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T5`.<br>3. Run `node --test gateway/tests/kongConfig.test.mjs` for the same rules on the file itself. |
| Test Data | /registration/api/v1/venues (a staff path under the public prefix); /healthz, /readyz, /registration/healthz, /event/healthz; /nowhere; POST /identity/api/v1/auth/login with no token |
| Expected Result | The staff path under the public prefix is answered by the registration service as not found (planning-core is never reached through it); every health path and the unknown prefix is Kong's own 404; login needs no token (it reaches planning-core, which refuses the empty credentials with its own 400). In the file, every staff route has the jwt plugin and a per-user limit, every public route has a per-address limit, staff and public services use different upstreams. |
| Acceptance criterion | Separate staff and public routes. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result |  |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By |  |
| Date of Execution |  |
