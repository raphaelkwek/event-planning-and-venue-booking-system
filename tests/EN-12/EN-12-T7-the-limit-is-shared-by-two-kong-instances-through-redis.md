# EN-12-T7 — Two Kong instances share one count through Redis

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T7 |
| Test Scenario | Two Kong instances share one count through Redis |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T7`. |
| Test Data | 20 requests to the public login route alternating between Kong on :8000 and Kong on :8100, then the 21st to each in turn |
| Expected Result | Each instance served 10 requests, under the limit on its own, yet the 21st is 429 on whichever instance gets it, and the next is 429 on the other. The key is in Redis. |
| Acceptance criterion | Rate limits backed by Redis. |
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
