# EN-07-T2 — planning-core asks the policy decision point on every protected route, and refuses a role the policy never allows

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T2 |
| Test Scenario | planning-core asks the policy decision point on every protected route, and refuses a role the policy never allows |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root.<br>2. A Cerbos policy decision point serving `policies/` at `CERBOS_URL` (`npm run cerbos:start`, or CI's Cerbos service container).<br>3. `DATABASE_URL` pointing at a throwaway Postgres built with `npm run migrate:all` (in CI, the runner's own Postgres). Never the team's shared database. |
| Test Steps | 1. Sign in as `organiser@connectsphere.test`.<br>2. Send `POST /api/v1/events/<any event id>/approve` with an empty body.<br>3. Sign in as `coordinator@connectsphere.test` and send `POST /api/v1/venues` with a valid venue.<br>4. Check the database for a new decision or venue. |
| Test Data | Accounts: `organiser@connectsphere.test`, `coordinator@connectsphere.test` / `ConnectSphere-Test-1234!`. Policy rules: event `approve` (assigned coordinator only), venue `create` (Venue Staff only). |
| Expected Result | Both requests are refused with `403`, code `ROLE_NOT_AUTHORISED`, message "Your role is not authorised to use this function." Nothing is stored. The decision came from the policy decision point (the route names a policy resource and action, not a list of roles). |
| Acceptance criterion | AC1: Cerbos policies in the repo, evaluated by the gateway, the services and the SPA's navigation. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Against the real PDP, POST /api/v1/events/{id}/approve as an organiser and POST /api/v1/venues as a coordinator both answered 403 ROLE_NOT_AUTHORISED; the gate's own test asserted the message "Your role is not authorised to use this function." and that the route's handler never ran. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7f1c8fa · Evidence: backend/services/planning-core/tests/shared/authz.unit.test.ts › EN-07-T2 refuses a role the policy never allows with 403 ROLE_NOT_AUTHORISED; backend/services/planning-core/tests/api/authorisationMatrix.test.ts › EN-07-T11 every route × role × related and unrelated record answers as the Cerbos PDP decides, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
