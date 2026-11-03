# EN-03-T12 — F2's status history is read from the stream

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T12 |
| Test Scenario | F2's status history is read from the stream |
| Category | Happy path |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T12` in `backend/services/planning-core/tests/event/api/en03HistoryReads.test.ts`. |
| Test Data | An event submitted by an organiser, opened and approved by a coordinator through the API. Then the event's `event_history` rows are removed, leaving only the stream. |
| Expected Result | `GET /api/v1/events/{id}/status-history`, as the organiser, still answers 200 with all three changes, oldest first: Draft → Submitted (Event Organiser), Submitted → Under Review and Under Review → Approved (Event Coordinator), each with its time and action, and no field changes. The response has the same shape as before EN-03. |
| Acceptance criterion | F1's and F2's history reads come from the stream. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | After the event's event_history rows were deleted, GET /status-history returned 200 with a body identical to the one before: Draft → Submitted (Event Organiser, SUBMIT), Submitted → Under Review and Under Review → Approved (Event Coordinator), oldest first, each with the same fields as before EN-03. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/api/en03HistoryReads.test.ts › F1 and F2 read the stream (EN-03 criterion 4) › EN-03-T12 F2's status history is read from the stream, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
