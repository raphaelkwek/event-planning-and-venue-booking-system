# EN-13-T9 — Race: 500 attendees for 100 seats leave exactly 100 registered

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-13-T9 |
| Test Scenario | Race: 500 attendees for 100 seats leave exactly 100 registered |
| Pre-conditions | Dependencies installed (`npm install`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres. Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests whose names end `(EN-13-T9)`, in `backend/services/registration/tests/` (and for T1 and T7, `backend/services/planning-core/tests/venue/api/bookingDecisions.test.ts`). |
| Test Data | A 100-seat event, 500 simultaneous claims over 20 connections; and 2 simultaneous claims for the last seat. Each test creates fresh random event ids and deletes its seats afterwards. |
| Expected Result | Exactly 100 claims succeed, each a different seat, and 400 get nothing; exactly one of two racers gets the last seat. With the row lock removed the test fails (326 winners), so it detects the defect. |
| Acceptance criterion | The seat claim is atomic: two attendees racing for the last place cannot both get it, and racers lock different rows. |
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
