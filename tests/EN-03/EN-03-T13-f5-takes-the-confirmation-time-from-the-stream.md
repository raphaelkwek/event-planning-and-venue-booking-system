# EN-03-T13 — F5's confirmation takes the time of the latest status change from the stream

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T13 |
| Test Scenario | F5's confirmation takes the time of the latest status change from the stream |
| Category | Happy path |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T13` in `backend/services/planning-core/tests/event/api/en03HistoryReads.test.ts`. |
| Test Data | A seeded Planning event with one status change in the stream on 1 Oct and a later one on 2 Oct, neither in `event_history`. |
| Expected Result | The latest status change time read for the event is 2 Oct's, the one only the stream holds. |
| Acceptance criterion | F1's and F2's history reads come from the stream. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With two stream-only status changes and no history rows, the latest status change time read was 2026-10-02T00:00:00.000Z. |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/api/en03HistoryReads.test.ts › F1 and F2 read the stream (EN-03 criterion 4) › EN-03-T13 F5's confirmation takes the time of the latest status change from the stream, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
