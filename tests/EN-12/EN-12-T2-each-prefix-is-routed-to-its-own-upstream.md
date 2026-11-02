# EN-12-T2 — Requests reach the service their prefix names, with the prefix stripped

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-12-T2 |
| Test Scenario | Requests reach the service their prefix names, with the prefix stripped |
| Pre-conditions | 1. The `Gateway integration` job of `.github/workflows/gateway.yml` (or the same steps on a machine with Docker): a throwaway Postgres built with `npm run migrate:all`, a Redis, the CI-only fake Supabase JWKS server, planning-core, notification and registration, and two Kong 3.9 containers on ports 8000 and 8100 sharing that Redis. Never the team's Supabase project. |
| Test Steps | 1. Run `node --test gateway/tests/integration/gateway.int.mjs` once the stack is up (the workflow does this).<br>2. Find the test named `EN-12-T2`. |
| Test Data | Valid tokens for the seeded organiser and attendee. GET /identity/api/v1/users/me, /event/api/v1/events, /notification/api/v1/notifications, /registration/api/v1/open-events, /registration/api/v1/registrations through Kong on :8000 |
| Expected Result | /identity and /event are answered by planning-core (200 with the caller, 200 with a list); /notification by the notification service; /registration by the registration service. Each response carries the upstream's own `x-correlation-id` echo and its own JSON shape, so a wrong upstream would be seen. |
| Acceptance criterion | Kong routes requests to planning-core, notification and the registration service. |
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
