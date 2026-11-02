# EN-12-T10 — `traceparent` and `x-correlation-id` are generated when absent, kept when present, reach the upstream and come back in the response

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T10 |
| Test Scenario | `traceparent` and `x-correlation-id` are generated when absent, kept when present, reach the upstream and come back in the response |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T10`. |
| Test Data | Staff and public requests through the echo upstream, with and without a `traceparent` and an `x-correlation-id`; a malformed `traceparent` |
| Expected Result | Without either header the upstream receives a UUID `x-correlation-id` and a valid `00-<32 hex>-<16 hex>-01` `traceparent`, and the response carries both. With a valid `traceparent` the upstream receives the same trace id and a new span id; with a malformed one it receives a fresh valid value. A caller's `x-correlation-id` is passed through unchanged. A real service (registration) echoes the same `x-correlation-id` in its response. |
| Acceptance criterion | Trace headers. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Absent headers were generated (UUID, 00-<32 hex>-<16 hex>-01) and echoed in the response; a valid traceparent kept its trace id and flags with a new span id; four malformed or all-zero values were replaced; a caller's x-correlation-id was kept; staff routes and the real registration service saw and echoed the id. |
| Status | Pass |
| Remarks | Automated (CI integration) · Commit: 0f598810aac420697e6b567bc3e616d7103af24c · Evidence: gateway/tests/integration/gateway.int.mjs › EN-12-T10 generates or propagates traceparent and x-correlation-id, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41529930983 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
