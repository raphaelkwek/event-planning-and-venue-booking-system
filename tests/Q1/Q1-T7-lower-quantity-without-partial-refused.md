# Q1-T7 — A lower quantity without partial is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T7 |
| Test Scenario | Technical Support must explicitly choose a partial reservation; otherwise nothing is reserved |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. A CHAIRS line (quantity 5, Confirmed) for E1. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data.<br>2. Read `equipment.reservations` for the line and the line's row.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T7 '` (or the whole suite) and read the named `Q1-T7 ` result. |
| Test Data | `{"quantity":3}` |
| Expected Result | HTTP 409 `PARTIAL_NOT_CONFIRMED`; the message says 5 were requested and to confirm a partial reservation of 3. Nothing is stored and the line is still `CONFIRMED`. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-15 |

> **Expected results are checked by the PR reviewer** against Q1's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
