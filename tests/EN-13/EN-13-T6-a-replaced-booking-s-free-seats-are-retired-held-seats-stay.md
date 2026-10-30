# EN-13-T6 — A replaced booking's free seats are retired, held seats stay

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-13-T6 |
| Test Scenario | A replaced booking's free seats are retired, held seats stay |
| Pre-conditions | Dependencies installed (`npm install`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres. Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests whose names end `(EN-13-T6)`, in `backend/services/registration/tests/` (and for T1 and T7, `backend/services/planning-core/tests/venue/api/bookingDecisions.test.ts`). |
| Test Data | A 10-seat booking with one seat claimed, replaced by a 6-seat approval. Each test creates fresh random event ids and deletes its seats afterwards. |
| Expected Result | 9 free seats retired; the claimed seat stays; 6 new free seats exist; nothing retired can be claimed. |
| Acceptance criterion | CR-02: when an approval replaces a booking, the replaced booking no longer provides places. |
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
