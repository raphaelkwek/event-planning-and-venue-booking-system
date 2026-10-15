# Q1-T12 — A reservation that only touches another at its edge does not overlap it

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T12 |
| Test Scenario | Periods are half-open, so one ending as another starts leaves availability unchanged |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. An existing reservation of CHAIRS, quantity 10, for `D 18:00`–`D 20:00` (starting as E1 ends); a CHAIRS line (quantity 10, Confirmed) for E1. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data.<br>2. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T12 '` (or the whole suite) and read the named `Q1-T12 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 201; reservedQuantity 10. The two periods only touch, so the earlier reservation does not reduce what is available. |
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
