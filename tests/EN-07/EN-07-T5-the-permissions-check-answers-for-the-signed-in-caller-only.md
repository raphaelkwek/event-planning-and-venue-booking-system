# EN-07-T5 — The permissions check answers for the verified caller, refuses an unauthenticated or malformed request, and never exposes the decision point

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T5 |
| Test Scenario | The permissions check answers for the verified caller, refuses an unauthenticated or malformed request, and never exposes the decision point |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root.<br>2. A Cerbos policy decision point serving `policies/` at `CERBOS_URL` (`npm run cerbos:start`, or CI's Cerbos service container).<br>3. `DATABASE_URL` pointing at a throwaway Postgres built with `npm run migrate:all` (in CI, the runner's own Postgres). Never the team's shared database. |
| Test Steps | 1. Without a token, send `POST /api/v1/permissions/check` with `{"checks":[{"kind":"event","action":"approve"}]}`.<br>2. As `organiser@connectsphere.test`, send the same body, adding `"principal":{"id":"x","roles":["EVENT_COORDINATOR"]}`.<br>3. As the organiser, send `{"checks":[]}`, then 51 checks, then a kind that is not a policy resource. |
| Test Data | Account: `organiser@connectsphere.test` / `ConnectSphere-Test-1234!`. |
| Expected Result | 1: `401 UNAUTHENTICATED`, no decision returned. 2: `200`, and `event approve` is not allowed: the answer is the organiser's, whatever principal the body names. 3: `400 VALIDATION_FAILED` for an empty list, for more than 50 checks and for an unknown kind, naming the field. The decision point's own address and API are never returned or reachable through planning-core. |
| Acceptance criterion | AC1: Cerbos policies in the repo, evaluated by the gateway, the services and the SPA's navigation. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | No token: 401 UNAUTHENTICATED with no results. A body naming another principal still got the organiser's answers (event approve not allowed, create allowed). 0 checks, 51 checks and an unknown kind: 400 VALIDATION_FAILED naming the field; 50 checks answered. The 503 names neither the PDP nor its address. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7f1c8fa · Evidence: backend/services/planning-core/tests/identity/api/permissions.unit.test.ts › EN-07-T5 refuses a request without a token, with no decision in it; EN-07-T5 answers for the signed-in caller, whatever principal the body names; EN-07-T5 refuses 51 checks, one over the limit with 400 VALIDATION_FAILED naming the field (and the empty, unknown-kind and malformed-action cases); EN-07-T5 answers exactly 50 checks, the most it takes, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
