# A4-T2 — A coordinator's review queue (D1) holds only the requests assigned to them

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T2 |
| Test Scenario | A coordinator's review queue (D1) holds only the requests assigned to them |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C1, send `GET /api/v1/events/queue`.<br>2. As C2, send `GET /api/v1/events/queue`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T2 '` and read the named `A4-T2 ` result. |
| Test Data | Actors C1, C2. E1 and E6 (C1's, awaiting a decision), E2 (C1's, Approved), E3 (unassigned), E4 (C2's). |
| Expected Result | C1's queue holds exactly E6 then E1, oldest submission first. It leaves out E2 (decided), E3 (still in the Lead's queue) and E4 (C2's). C2's queue holds exactly E4. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | C1's queue held E1 then E6, oldest first, and left out E2, E3 and E4. C2's queue held exactly E4. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: c944c5e · Evidence: `backend/services/planning-core/tests/event/api/a4Cards.test.ts` › A4 cards (tests/A4) › A4-T2 a coordinator's review queue (D1) holds only the requests assigned to them, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41598779764 · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
