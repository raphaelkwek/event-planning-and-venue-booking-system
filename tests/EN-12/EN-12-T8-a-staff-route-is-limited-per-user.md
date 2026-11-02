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
| Actual Result | User A's 16th request (alternating instances) was 429 with Retry-After; user B, from the same address, was answered by the service. (CI limit: 15 a minute; committed: 300.) |
| Status | Pass |
| Remarks | Automated (CI integration) · Commit: 0f598810aac420697e6b567bc3e616d7103af24c · Evidence: gateway/tests/integration/gateway.int.mjs › EN-12-T8 limits a staff route per user, not per address, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41529930983 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
