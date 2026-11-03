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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
