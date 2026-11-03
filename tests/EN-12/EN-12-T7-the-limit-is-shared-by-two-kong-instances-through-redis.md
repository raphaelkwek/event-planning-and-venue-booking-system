# EN-12-T7 — Two Kong instances share one count through Redis

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T7 |
| Test Scenario | Two Kong instances share one count through Redis |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T7`. |
| Test Data | 20 requests to GET /registration/api/v1/open-events with no token, alternating between Kong on :8000 and Kong on :8100, then the 21st to each in turn |
| Expected Result | Each instance served 10 requests (answered 401 by the registration service, which wants a token), under the limit on its own, yet the 21st is 429 on whichever instance gets it, and the next is 429 on the other. The key is in Redis. |
| Acceptance criterion | Rate limits backed by Redis. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | 20 requests alternating between Kong :8000 and :8100 were each 401 from the registration service (10 per instance); the 21st on A and the next on B were both 429 with Retry-After. |
| Status | Pass |
| Remarks | Automated (CI integration) · Commit: 0f598810aac420697e6b567bc3e616d7103af24c · Evidence: gateway/tests/integration/gateway.int.mjs › EN-12-T7 shares one count between two Kong instances through Redis, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41529930983 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
