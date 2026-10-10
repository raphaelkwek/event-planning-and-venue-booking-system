# O2-T16 — The coordinator and Technical Support see the updated status

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T16 |
| Test Scenario | The coordinator learns what will be provided: the list for the event shows the new statuses, and Technical Support can filter by status |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. Two events: E1 with a CHAIRS line and a PROJECTORS line, and a second event E2 with one line. |
| Test Steps | 1. As TS, set the CHAIRS line of E1 to `CONFIRMED`.<br>2. As C1, send `GET /api/v1/equipment/request-lines?eventId=<E1>`.<br>3. As TS, send `GET /api/v1/equipment/request-lines?status=SUBMITTED`, then `GET /api/v1/equipment/request-lines`.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T16 '` (or the whole suite) and read the named `O2-T16 ` result. |
| Test Data | As in the steps. |
| Expected Result | C1's list shows the CHAIRS line as `CONFIRMED` and the PROJECTORS line as `SUBMITTED`. TS's filtered list contains the Submitted lines of both events and not the Confirmed line; the unfiltered list contains all lines of both events, each with its event reference. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
