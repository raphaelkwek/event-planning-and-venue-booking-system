# EN-03-T7 — Every writer of an event's history appends to the stream

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T7 |
| Test Scenario | Every writer of an event's history appends to the stream |
| Category | Happy path |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T7` in `backend/services/planning-core/tests/event/repo/eventStream.test.ts`. |
| Test Data | Seeded events, one per writer: D3's clarification amendments (two fields), G1's details edit (one field), S2's approved change (expected attendance 150 → 200). |
| Expected Result | For each writer, every `event_history` row it wrote has a stream entry with the same id, the same event, type, values, acting user, role, action and time. The entries' versions continue the event's stream without a gap, and the chain verifies. |
| Acceptance criterion | Projections update in the same transaction as the append, together with the outbox row. |
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
