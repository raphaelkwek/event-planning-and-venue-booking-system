# DEPLOY-T5 — Only the public API routes are exposed through Traefik, with the service prefix stripped

## Specification

| Item | Content |
|---|---|
| Test Case ID | DEPLOY-T5 |
| Test Scenario | Only the public API routes are exposed through Traefik, with the service prefix stripped |
| Pre-conditions | 1. The `kind: k3s staging overlay` job has deployed the overlay behind Traefik. |
| Test Steps | 1. Through Traefik on the API host, `GET /identity/api/v1/users/me` with no token.<br>2. `GET /healthz`, `/identity/healthz`, `/metrics` and `/registration/healthz` through Traefik.<br>3. `GET /registration/api/v1/does-not-exist` and `/notification/api/v1/notifications` with no token. |
| Test Data | None. |
| Expected Result | Step 1 answers 401 with the error envelope from planning-core (the prefix was stripped). Step 2 answers 404 from Traefik for every path. Step 3 reaches registration and notification (their own 401 or 404, not Traefik's). |
| Acceptance criterion | Expose only planning-core's public API and registration's public routes (and notification's, which the SPA calls), routed straight to the services while Kong is not on main. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Through Traefik over TLS on api.staging.ci.invalid: GET /identity/api/v1/users/me and /notification/api/v1/notifications with no token answered 401 with the error envelope; /registration/api/v1/... was answered by registration, not Traefik; /healthz, /readyz, /metrics, /identity/healthz, /identity/readyz, /registration/healthz and /notification/metrics answered Traefik's 404. |
| Status | Pass |
| Remarks | Automated (kind, CI) · Commit: f76866586a318aa5852f75edab518cb95ffd7690 · Evidence: deploy/release/smoke-api.sh in job 'kind: k3s staging overlay (Redpanda, Temporal, Cerbos, Traefik)', CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41614563160 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
