# EN-07-T11 — For every route × every role × a related and an unrelated resource, the HTTP result matches the policy decision point's decision

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T11 |
| Test Scenario | For every route × every role × a related and an unrelated resource, the HTTP result matches the policy decision point's decision |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root.<br>2. A Cerbos policy decision point serving `policies/` at `CERBOS_URL` (`npm run cerbos:start`, or CI's Cerbos service container).<br>3. `DATABASE_URL` pointing at a throwaway Postgres built with `npm run migrate:all` (in CI, the runner's own Postgres). Never the team's shared database. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Read the results of `authorisationMatrix.test.ts`. |
| Test Data | Cases generated from the routes planning-core serves (the same table the OpenAPI test checks) × the six roles × two resources: one related to the caller (their own event, an event assigned to them, a venue they manage) and one unrelated (someone else's). |
| Expected Result | One case per route, role and resource. Where Cerbos denies the action, the response is `403 ROLE_NOT_AUTHORISED` (the role is never allowed) or `404` (the role is allowed only for related records, and this one is not). Where Cerbos allows it, the response is neither of those. Every case passes. |
| Acceptance criterion | AC3: A generated matrix test covering role × endpoint × related and unrelated resources. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Every gated and session route × seven roles × a related and an unrelated record answered as the PDP decided: 403 ROLE_NOT_AUTHORISED where the role is never allowed, 403 or 404 with nothing of the record where Cerbos or RLS refused it, and past authorisation otherwise. No mismatches. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7f1c8fa · Evidence: backend/services/planning-core/tests/api/authorisationMatrix.test.ts › EN-07-T11 every route × role × related and unrelated record answers as the Cerbos PDP decides (the matrix is in the run's job summary), CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41640443625 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
