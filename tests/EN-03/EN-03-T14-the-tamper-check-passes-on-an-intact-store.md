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
| Actual Result | verify over the whole store found no broken link and no mismatched history row and reported ok. In the CI step, npm run event-store:verify printed "Checked 436 stream entries across 291 events.", "Every chain is intact." and "Every history row matches its stream entry." and exited 0. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts › the tamper check (EN-03 criterion 5) › EN-03-T14 the tamper check passes on an intact store, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
