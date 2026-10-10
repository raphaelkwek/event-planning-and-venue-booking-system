# O1-T20 — A Reserved line cannot be removed

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T20 |
| Test Scenario | A line with status Reserved cannot be removed here, and nothing changes |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40) with status `RESERVED`. |
| Test Steps | 1. As C1, send `POST /api/v1/equipment/request-lines/<id>/removal`.<br>2. Read the line row and its history rows again.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T20 '` (or the whole suite) and read the named `O1-T20 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 409 `EQUIPMENT_LINE_NOT_EDITABLE` naming the status Reserved. Row and history are identical to before; no `REMOVED` history entry exists. |
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
