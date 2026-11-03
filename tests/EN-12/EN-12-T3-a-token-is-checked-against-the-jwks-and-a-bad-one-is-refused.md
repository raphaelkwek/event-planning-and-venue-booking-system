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
| Actual Result | No token, a malformed token, a forged signature, an expired token and an unknown key id each got 401 from Kong without reaching planning-core (no x-kong-upstream-latency, no service envelope); a valid token got 200, on both Kong instances. |
| Status | Pass |
| Remarks | Automated (CI integration) · Commit: 0f598810aac420697e6b567bc3e616d7103af24c · Evidence: gateway/tests/integration/gateway.int.mjs › EN-12-T3 refuses no token, a malformed token, a wrong key, an expired token and an unknown key id, and lets a valid token through, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41529930983 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
