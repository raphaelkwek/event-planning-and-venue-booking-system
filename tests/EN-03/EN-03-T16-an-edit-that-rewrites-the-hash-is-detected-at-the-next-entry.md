# EN-03-T16 — An edit that also rewrites the entry's hash is detected at the next entry

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-03-T16 |
| Test Scenario | An edit that also rewrites the entry's hash is detected at the next entry |
| Category | Negative |
| Pre-conditions | Dependencies installed (`npm ci`). `DATABASE_URL` points at a Postgres built from every migration with `npm run migrate:all`: in CI, the integration job's throwaway Postgres. Never the team's shared database. Run from the repository root. |
| Test Steps | 1. Run `npm run test:coverage -w @connectsphere/planning-core` (CI's integration job).<br>2. Find the test whose name starts `EN-03-T16` in `backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts`. |
| Test Data | The event from EN-03-T15. Version 2's data edited and its `hash` recomputed to match, in a rolled-back transaction. |
| Expected Result | The check fails at version 3 of that event: its `prev_hash` no longer equals version 2's hash. Version 2 itself is not reported, as its own hash now matches. |
| Acceptance criterion | A tamper check detects an edited entry. |
| Created By | Joash |
| Date of Creation | 2026-11-03 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | With version 2's data edited and its hash recomputed, verify reported version 3, PREVIOUS_HASH_MISMATCH: "its prev_hash is not the hash of version 2, so an earlier entry was changed". |
| Status | Pass |
| Remarks | Automated (integration, CI) · Commit: 7f31ecac5107ee470305a850ad7a6e881c900a90 · Evidence: backend/services/planning-core/tests/event/repo/eventStreamVerification.test.ts › the tamper check (EN-03 criterion 5) › EN-03-T16 an edit that also rewrites the entry's hash is detected at the next entry, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41610286516 · Defect: — |
| Executed By | Joash, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
