# EN-12-T6 — A public route allows its budget per address and then answers 429 with Retry-After

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T6 |
| Test Scenario | A public route allows its budget per address and then answers 429 with Retry-After |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. The CI rendering sets the public limit to 20 a minute (production: 600), so the test sends that many. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T6`. |
| Test Data | 21 POST /identity/api/v1/auth/login requests from one address within one minute, no token |
| Expected Result | Requests 1 to 20 are answered by planning-core (not 429); request 21 is 429 from Kong, before planning-core, with a Retry-After header that is a whole number of seconds from 1 to 60. |
| Acceptance criterion | Per-IP rate limits, answered 429 with Retry-After. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 20 sign-in requests were answered 400 by planning-core; the 21st was 429 from Kong with a whole-number Retry-After of 1 to 60 seconds, without reaching planning-core. (CI limit: 20 a minute; committed: 600.) |
| Status | Pass |
| Remarks | Automated (CI integration) · Commit: 0f598810aac420697e6b567bc3e616d7103af24c · Evidence: gateway/tests/integration/gateway.int.mjs › EN-12-T6 limits a public route per address and answers 429 with Retry-After, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41529930983 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
