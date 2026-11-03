# EN-03-T14 — The tamper check passes on an intact store

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T14 |
| Test Scenario | The tamper check passes on an intact store |
| Category | Happy path |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T14` in `backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts`. |
| Test Data | Every stream entry the whole integration suite wrote. In CI, `npm run event-store:verify` runs after the planning-core, notification and registration integration tests. |
| Expected Result | The check reports how many entries and events it checked, says every chain is intact and every projection row matches its entry, and exits 0. |
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
