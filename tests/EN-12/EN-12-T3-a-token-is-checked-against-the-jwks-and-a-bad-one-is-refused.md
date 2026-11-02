# EN-12-T3 — Kong checks the bearer token against the signing keys: none, malformed, wrong key and expired are refused with 401; a valid one passes

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T3 |
| Test Scenario | Kong checks the bearer token against the signing keys: none, malformed, wrong key and expired are refused with 401; a valid one passes |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T3`. |
| Test Data | GET /event/api/v1/events with: no Authorization header; `Bearer not-a-token`; a token signed by a different key; a token past its expiry; a token for a key id Kong has no credential for; a valid token |
| Expected Result | The first five answer 401 from Kong (`{"message": ...}`, not planning-core's envelope, so planning-core was never reached). The valid token reaches planning-core (200). |
| Acceptance criterion | Kong verifies Supabase JWTs against the JWKS. |
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
