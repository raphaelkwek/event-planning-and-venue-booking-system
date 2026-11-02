# EN-12-T8 — A staff route is limited per signed-in user: one user at the limit does not slow another

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T8 |
| Test Scenario | A staff route is limited per signed-in user: one user at the limit does not slow another |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. The CI rendering sets the staff limit to 15 a minute (production: 300). |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T8`. |
| Test Data | User A sends 16 GET /identity/api/v1/users/me; user B (another subject, same address) sends one afterwards |
| Expected Result | User A's 16th request is 429 with Retry-After; user B's request is not 429 although it comes from the same address. |
| Acceptance criterion | Per-user rate limits. |
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
