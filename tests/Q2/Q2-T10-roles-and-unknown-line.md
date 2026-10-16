# Q2-T10 — Only Technical Support releases; an unknown line is not found

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T10 |
| Test Scenario | Roles other than Technical Support are refused, and a line that does not exist is reported as such |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q2 from `tests/Q2/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), the actors TS, C1, ORG, VS and ATT, and line L1 (CHAIRS × 4 for E1, Confirmed, then reserved by TS through `POST /api/v1/equipment/request-lines/<L1>/reservation`, leaving 6 CHAIRS). |
| Test Steps | 1. As C1, ORG, VS and ATT in turn, send `POST /api/v1/equipment/request-lines/<id>/release` for L1 with the body in Test Data.<br>2. Read L1 after each request.<br>3. As TS, send the same request for an id that is not a line.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-T10 '` (or the whole suite) and read the named `Q2-T10 ` result. |
| Test Data | `{"reason":"x"}` |
| Expected Result | Each of C1, ORG, VS and ATT receives HTTP 403 and L1 is unchanged. The unknown id returns HTTP 404 `EQUIPMENT_LINE_NOT_FOUND`. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-16 |

> **Expected results are checked by the PR reviewer** against Q2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks |  |
| Executed By | |
| Date of Execution | |
