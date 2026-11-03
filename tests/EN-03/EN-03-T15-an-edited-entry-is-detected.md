# EN-03-T15 — An entry whose data was edited is detected

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T15 |
| Test Scenario | An entry whose data was edited is detected |
| Category | Negative |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T15` in `backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts`. |
| Test Data | An event with three stream entries. Version 2's `data.newStatus` edited from `UNDER_REVIEW` to `CONFIRMED`, with the append-only trigger switched off, in a transaction that is rolled back afterwards. |
| Expected Result | The check fails at the first broken link, naming the event and version 2: the stored hash does not match the entry. |
| Acceptance criterion | A tamper check detects an edited entry. |
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
