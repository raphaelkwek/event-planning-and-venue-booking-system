# EN-13-T1 — Build an event's seats from an approval's layout capacity

## Specification

| Item | Content |
|---|---|
| Test Case ID | EN-13-T1 |
| Test Scenario | Build an event's seats from an approval's layout capacity |
| Pre-conditions | Dependencies installed (`npm install`); `DATABASE_URL` pointing at a Postgres whose schemas are migrated with `npm run migrate:all`. In CI that is the runner's throwaway Postgres. Run from the repository root. |
| Test Steps | 1. Run `npm test -w @connectsphere/registration`.<br>2. Find the tests whose names end `(EN-13-T1)`, in `backend/services/registration/tests/` (and for T1 and T7, `backend/services/planning-core/tests/venue/api/bookingDecisions.test.ts`). |
| Test Data | An approval message for a 40-seat Theatre layout; a venue whose Theatre layout is changed to 240 after the request was raised. Each test creates fresh random event ids and deletes its seats afterwards. |
| Expected Result | 40 seats exist for the event, numbered 1 to 40, all PUBLIC and FREE. The approval message names the layout and the capacity the venue held at approval (240 after the change). No call to Venue is made. |
| Acceptance criterion | Seats are created from the confirmed booking (an approval naming layout and layoutCapacity); the venue module fills those fields from its own layouts at approval. |
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
