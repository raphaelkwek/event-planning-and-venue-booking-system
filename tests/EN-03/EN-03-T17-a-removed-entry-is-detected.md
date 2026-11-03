# EN-03-T17 — A removed entry is detected

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T17 |
| Test Scenario | A removed entry is detected |
| Category | Boundary |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T17` in `backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts`. |
| Test Data | The event from EN-03-T15. Version 2 removed (the last entry, version 3, is kept), in a rolled-back transaction. |
| Expected Result | The check fails at version 3 of that event: version 2 is missing from the sequence. |
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
