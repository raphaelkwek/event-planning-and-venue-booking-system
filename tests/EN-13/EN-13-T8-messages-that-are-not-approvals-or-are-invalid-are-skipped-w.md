# EN-13-T8 — Messages that are not approvals, or are invalid, are skipped without touching the database

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-13-T8 |
| Test Scenario | Messages that are not approvals, or are invalid, are skipped without touching the database |
| Pre-conditions | Dependencies installed (`npm install`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres. Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests whose names end `(EN-13-T8)`, in `backend/services/registration/tests/` (and for T1 and T7, `backend/services/planning-core/tests/venue/api/bookingDecisions.test.ts`). |
| Test Data | Text that is not JSON; an empty value; an approval with a missing field; a rejection message. Each test creates fresh random event ids and deletes its seats afterwards. |
| Expected Result | Each is reported as invalid or ignored; the database is not used. |
| Acceptance criterion | The seat builder only acts on a valid approval; a bad message never succeeds on a retry. |
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
