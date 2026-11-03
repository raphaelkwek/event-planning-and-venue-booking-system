# EN-03-T18 — `npm run event-store:verify` fails on CI's database after a row is edited

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T18 |
| Test Scenario | `npm run event-store:verify` fails on CI's database after a row is edited |
| Category | Negative |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. In CI's integration job, after every integration test, the step `Event store tamper check (EN-03)` runs `npm run event-store:verify`.<br>2. It edits one stream entry's data on the runner's throwaway Postgres (`scripts/ci-tamper-event-stream.ts`, which refuses any other database).<br>3. It runs `npm run event-store:verify` again. |
| Test Data | The stream the integration suite left on the runner's database. The entry edited is the first one, by event and version. |
| Expected Result | The first run exits 0. The second exits non-zero and names the edited entry's event and version as the first broken link. The step fails the build if the second run passes. |
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
