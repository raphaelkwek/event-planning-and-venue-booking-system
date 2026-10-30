# EN-13-T3 — Split seats into public and VIP pools

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-13-T3 |
| Test Scenario | Split seats into public and VIP pools |
| Pre-conditions | Dependencies installed (`npm install`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres. Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests whose names end `(EN-13-T3)`, in `backend/services/registration/tests/` (and for T1 and T7, `backend/services/planning-core/tests/venue/api/bookingDecisions.test.ts`). |
| Test Data | A 10-seat event with a VIP pool of 3 then 4 then 1; a 4-seat event with 3 seats held. Each test creates fresh random event ids and deletes its seats afterwards. |
| Expected Result | VIP seats take the highest numbers; claims in one pool never take a seat from the other; a held seat never moves, and the shortfall is reported. |
| Acceptance criterion | Seats sit in a PUBLIC and a VIP pool; the VIP pool's size can be set; only free seats move. |
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
