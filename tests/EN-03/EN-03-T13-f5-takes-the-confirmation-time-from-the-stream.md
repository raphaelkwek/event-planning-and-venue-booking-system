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
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: |
| Executed By | |
| Date of Execution | |
