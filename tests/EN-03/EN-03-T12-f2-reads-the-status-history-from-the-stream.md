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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
