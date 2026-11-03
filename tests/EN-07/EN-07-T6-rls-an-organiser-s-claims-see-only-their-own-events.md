# EN-07-T6 — Under the request role with an organiser's claims, a query with no WHERE clause returns only that organiser's events

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-07-T6 |
| Test Scenario | Under the request role with an organiser's claims, a query with no WHERE clause returns only that organiser's events |
| Pre-conditions | 1. Dependencies installed (`npm ci`), run from the repository root.<br>2. A Cerbos policy decision point serving `policies/` at `CERBOS_URL` (`npm run cerbos:start`, or CI's Cerbos service container).<br>3. `DATABASE_URL` pointing at a throwaway Postgres built with `npm run migrate:all` (in CI, the runner's own Postgres). Never the team's shared database. |
| Test Steps | 1. Create two events, one owned by organiser A, one by organiser B, plus a draft owned by A.<br>2. In one transaction: `SET LOCAL ROLE connectsphere_request`, set claims for organiser A with the owner scope, then `select id from event.events` (no WHERE).<br>3. Repeat with organiser B's claims. |
| Test Data | Two random organiser ids; scope `OWNED_BY_USER`. |
| Expected Result | A's transaction returns A's event and A's draft and nothing of B's. B's returns only B's event. |
| Acceptance criterion | AC2: A3 (and A4's assigned-only scope) enforced with Postgres row-level security, using a per-request role and `SET LOCAL` claims inside each transaction. |
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
