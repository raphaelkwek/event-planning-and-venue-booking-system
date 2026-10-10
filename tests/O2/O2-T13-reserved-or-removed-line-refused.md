# O2-T13 — A Reserved or Removed line cannot be changed through O2

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T13 |
| Test Scenario | A change to a line that is Reserved or has been Removed is refused and leaves it as it was |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. One CHAIRS line with status `RESERVED` and one with status `REMOVED`. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/status` with the body in Test Data for each line.<br>2. Read both rows.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T13 '` (or the whole suite) and read the named `O2-T13 ` result. |
| Test Data | `{"status":"CONFIRMED"}` |
| Expected Result | Each request returns HTTP 409 `STATUS_TRANSITION_NOT_PERMITTED` naming the line's current status. Both rows are unchanged. |
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
