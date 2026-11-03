# A4-T1 — A coordinator's event list holds only the events assigned to them

## Specification

| Item | Content |
|---|---|
| Test Case ID | A4-T1 |
| Test Scenario | A coordinator's event list holds only the events assigned to them |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/F5/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names.<br>2. Fixture FX-A4 from `tests/A4/README.md`. |
| Test Steps | 1. As C1, send `GET /api/v1/events`.<br>2. As C2, send `GET /api/v1/events`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/event/api/a4Cards.test.ts -t 'A4-T1 '` and read the named `A4-T1 ` result. |
| Test Data | Actors C1, C2. Events E1 to E6 of FX-A4. |
| Expected Result | C1's list holds exactly E1, E2 and E6, each marked as assigned to C1. It holds no E3 (unassigned), no E4 (C2's) and no E5 (a draft), and no field of theirs appears anywhere in the body. C2's list holds exactly E4. |
| Created By | Shawmya |
| Date of Creation | 2026-11-02 |

> **Expected results are checked by the story owner** against A4's acceptance criteria before the code
> is written (implementation.md §11.12).

## Execution record

| Item | Content |
|---|---|
| Actual Result | C1's list held exactly E1, E2 and E6, each with C1 as assigned coordinator; no field of E3, E4 or E5 appeared. C2's list held exactly E4. |
| Status | Pass |
| Remarks | Automated (API level) · Commit: c944c5e · Evidence: `backend/services/planning-core/tests/event/api/a4Cards.test.ts` › A4 cards (tests/A4) › A4-T1 a coordinator's event list holds only the events assigned to them, CI run https://github.com/raphaelkwek/event-planning-and-venue-booking-system/actions/runs/41598779764 · Defect: — |
| Executed By | Shawmya, via automated testing (CI) |
| Date of Execution | 2026-11-03 |
