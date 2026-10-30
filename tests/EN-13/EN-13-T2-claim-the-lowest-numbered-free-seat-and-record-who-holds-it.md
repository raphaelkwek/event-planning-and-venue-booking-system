# EN-13-T2 — Claim the lowest-numbered free seat and record who holds it

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-13-T2 |
| Test Scenario | Claim the lowest-numbered free seat and record who holds it |
| Pre-conditions | Dependencies installed (`npm install`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres. Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests whose names end `(EN-13-T2)`, in `backend/services/registration/tests/` (and for T1 and T7, `backend/services/planning-core/tests/venue/api/bookingDecisions.test.ts`). |
| Test Data | A 3-seat event; a 1-seat event; an event with no seats; fresh attendee ids. Each test creates fresh random event ids and deletes its seats afterwards. |
| Expected Result | Claims return seats 1, 2, ...; the row is CLAIMED with the attendee and a timestamp; a full pool and an event with no seats both return null. |
| Acceptance criterion | A registration claims a free seat in one statement; the holder and time are recorded; no free seat returns nothing. |
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
