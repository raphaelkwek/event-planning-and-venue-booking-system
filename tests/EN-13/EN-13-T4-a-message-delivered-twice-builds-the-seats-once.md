# EN-13-T4 — A message delivered twice builds the seats once

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-13-T4 |
| Test Scenario | A message delivered twice builds the seats once |
| Pre-conditions | Dependencies installed (`npm install`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres. Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests whose names end `(EN-13-T4)`, in `backend/services/registration/tests/` (and for T1 and T7, `backend/services/planning-core/tests/venue/api/bookingDecisions.test.ts`). |
| Test Data | The same approval message handled twice; the same booking built twice. Each test creates fresh random event ids and deletes its seats afterwards. |
| Expected Result | The first delivery builds the seats and records the message id in the inbox; the second reports a duplicate and adds none. |
| Acceptance criterion | Seat creation is idempotent: the inbox and the unique seat number refuse a duplicate. |
| Created By | Yichen, via Claude |
| Date of Creation | 2026-10-30 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | Registration: 5 files, 38 tests passed. Venue approval: `bookingDecisions.test.ts`, 27 tests passed. Contracts: 143 tests passed. |
| Status | Pass |
| Remarks | Commit: not yet committed · Evidence: the vitest output · Environment: a throwaway local Postgres (embedded-postgres, no Docker, not the shared database) with `npm run migrate:all` applied · Defect: — |
| Executed By | Yichen, via automated testing |
| Date of Execution | 2026-10-30 |
