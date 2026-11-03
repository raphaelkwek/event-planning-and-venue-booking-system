# EN-12-T9 — A client-sent `x-user-id` is replaced by the token's subject (staff) or removed (public)

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T9 |
| Test Scenario | A client-sent `x-user-id` is replaced by the token's subject (staff) or removed (public) |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T9`. |
| Test Data | A staff request and a public request through the echo upstream (rendered into the CI configuration only), each carrying `x-user-id: someone-else`; a staff request with a valid token and no such header |
| Expected Result | The echo upstream sees `x-user-id` equal to the token's `sub` on the staff route, whatever the client sent, and no `x-user-id` at all on the public route. |
| Acceptance criterion | Per-user rate limits (the key cannot be forged to dodge a limit). |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The echo upstream saw x-user-id equal to the token's sub on the staff route whatever the client sent, and none on the public route; the Authorization header and the stripped path reached it. |
| Status | Pass |
| Remarks | Automated (CI integration) · Commit: 0f598810aac420697e6b567bc3e616d7103af24c · Evidence: gateway/tests/integration/gateway.int.mjs › EN-12-T9 overwrites a client-sent x-user-id with the token's subject, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41529930983 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
