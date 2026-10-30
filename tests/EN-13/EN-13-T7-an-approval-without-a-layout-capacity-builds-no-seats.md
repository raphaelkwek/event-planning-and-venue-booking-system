# EN-13-T7 — An approval without a layout capacity builds no seats

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-13-T7 |
| Test Scenario | An approval without a layout capacity builds no seats |
| Pre-conditions | Dependencies installed (`npm install`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres. Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests whose names end `(EN-13-T7)`, in `backend/services/registration/tests/` (and for T1 and T7, `backend/services/planning-core/tests/venue/api/bookingDecisions.test.ts`). |
| Test Data | An approval with no layout fields; an approval whose venue removed the requested layout. Each test creates fresh random event ids and deletes its seats afterwards. |
| Expected Result | The registration service ignores the message and logs a warning; the venue module leaves layout and layoutCapacity out of the message. |
| Acceptance criterion | No seats are built from a guess: the layout and capacity are optional on the message, and absent when the venue no longer offers the layout. |
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
