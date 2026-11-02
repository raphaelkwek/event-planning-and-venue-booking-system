# EN-12-T6 — A public route allows its budget per address and then answers 429 with Retry-After

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T6 |
| Test Scenario | A public route allows its budget per address and then answers 429 with Retry-After |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. The CI rendering sets the public limit to 20 a minute (production: 600), so the test sends that many. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T6`. |
| Test Data | 21 POST /identity/api/v1/auth/login requests from one address within one minute, no token |
| Expected Result | Requests 1 to 20 are answered by planning-core (not 429); request 21 is 429 from Kong with a Retry-After header that is a whole number of seconds from 1 to 60, and a `RateLimit-Limit` of 20. |
| Acceptance criterion | Per-IP rate limits, answered 429 with Retry-After. |
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
