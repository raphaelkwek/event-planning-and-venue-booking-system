# EN-12-T11 — Through the gateway, the browse API carries the CDN's cache headers and every personal response is `no-store`

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T11 |
| Test Scenario | Through the gateway, the browse API carries the CDN's cache headers and every personal response is `no-store` |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T11`. |
| Test Data | GET /registration/api/v1/open-events and /open-events/{id} as the attendee; GET /registration/api/v1/registrations; GET /identity/api/v1/users/me; a refusal (401) from the browse route |
| Expected Result | The two browse responses have `Cache-Control: public, max-age=5, stale-while-revalidate=30` and carry no registration of the caller; the registrations list and users/me are `no-store`; the 401 is not `public`. |
| Acceptance criterion | A CDN in front of the browse API, which never caches personal data. |
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
