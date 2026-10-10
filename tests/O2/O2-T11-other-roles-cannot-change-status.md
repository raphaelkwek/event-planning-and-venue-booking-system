# O2-T11 — Only Technical Support can change a line's status

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T11 |
| Test Scenario | The assigned coordinator and every other role are refused a status change and nothing changes |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted). |
| Test Steps | 1. For each of C1 (the assigned coordinator), C2, ORG, VS and ATT in turn, send `POST /api/v1/equipment/request-lines/<id>/status` with the body in Test Data.<br>2. Read the line row, history and outbox rows.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T11 '` (or the whole suite) and read the named `O2-T11 ` result. |
| Test Data | `{"status":"CONFIRMED"}` |
| Expected Result | Every request returns HTTP 403 `ROLE_NOT_AUTHORISED`. The line is still `SUBMITTED`; no history or outbox row was added. |
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
