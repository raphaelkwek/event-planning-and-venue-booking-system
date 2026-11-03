# EN-03-T9 — The backfill copies an event's existing history into the stream in time order

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T9 |
| Test Scenario | The backfill copies an event's existing history into the stream in time order |
| Category | Happy path |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T9` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | An event whose four `event_history` rows predate the stream (written with the capture switched off, as before EN-03), stored out of order: 3 Oct, 1 Oct, 2 Oct, and a field change on 2 Oct after the status change. |
| Expected Result | After the backfill the event's stream holds four entries with the rows' own ids, versions 1 to 4 in time order (1 Oct, 2 Oct status, 2 Oct field, 3 Oct), each with the row's values, and the chain verifies. |
| Acceptance criterion | The existing A–E history (`event_history`) is migrated into the stream. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | The backfill copied 4 rows. The stream held them with their own ids as versions 1–4 in time order (1 Oct, 2 Oct status, 2 Oct 12:00 field, 3 Oct) with their values, and the chain verified. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStream.test.ts › the backfill of the history written before the stream (EN-03 criterion 3) › EN-03-T9 the backfill copies an event's existing history into the stream in time order, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
