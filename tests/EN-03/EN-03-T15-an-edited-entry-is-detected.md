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
| Actual Result | With version 2's newStatus edited, verify reported the event, version 2, HASH_MISMATCH: "its stored hash does not match its contents, so the entry was changed". After the rollback the entry was intact again. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts › the tamper check (EN-03 criterion 5) › EN-03-T15 an entry whose data was edited is detected, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
