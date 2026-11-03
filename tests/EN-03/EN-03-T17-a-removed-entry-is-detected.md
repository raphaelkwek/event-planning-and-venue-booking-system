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
| Actual Result | With version 2 removed, verify reported version 3, VERSION_OUT_OF_SEQUENCE: "expected version 2 here, found 3, so an entry is missing", and the orphaned history row as having no stream entry. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts › the tamper check (EN-03 criterion 5) › EN-03-T17 a removed entry is detected, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
