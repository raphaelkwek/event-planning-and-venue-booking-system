# O2-T12 — Only the four O2 statuses can be set

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T12 |
| Test Scenario | Technical Support cannot set Reserved, Submitted or Removed, or an unknown status, through this change |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted). |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/status` once for each body in Test Data.<br>2. Read the line row after each.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T12 '` (or the whole suite) and read the named `O2-T12 ` result. |
| Test Data | `{"status":"RESERVED"}`, `{"status":"SUBMITTED"}`, `{"status":"REMOVED"}`, `{"status":"DONE"}`, `{}` |
| Expected Result | Each request returns HTTP 400 `VALIDATION_FAILED` naming `status`. The line is still `SUBMITTED` and no reservation exists. |
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
