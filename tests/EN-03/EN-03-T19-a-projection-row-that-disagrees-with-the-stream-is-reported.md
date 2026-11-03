# EN-03-T19 — A history projection row that disagrees with the stream is reported

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T19 |
| Test Scenario | A history projection row that disagrees with the stream is reported |
| Category | Negative |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T19` in `backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts`. |
| Test Data | An event with one stream entry. Its `event_history` row's `new_status` edited, in a rolled-back transaction. |
| Expected Result | The check fails, naming the event and the history row whose values no longer match the stream entry with its id. |
| Acceptance criterion | Projections update in the same transaction as the append, together with the outbox row. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With the history row's new_status edited, verify found no broken link but reported the row and event: "History row … of event … does not match its stream entry.", and the report failed. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts › the tamper check (EN-03 criterion 5) › EN-03-T19 a history projection row that disagrees with the stream is reported, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
