# Q1-T2 — Technical Support reserves a Confirmed serialized line

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T2 |
| Test Scenario | Reserving a serialized line holds that many individual units under one reservation |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. A PROJECTORS line (quantity 2, Confirmed) for E1. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data.<br>2. Read the rows of `equipment.unit_reservations` for the reservation.<br>3. As TS, send `GET /api/v1/equipment/types/<PROJECTORS>/availability` for E1's window with requestedQuantity 1.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T2 '` (or the whole suite) and read the named `Q1-T2 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 201; reservedQuantity 2 and kind `SERIALIZED`. `equipment.unit_reservations` holds two rows (`P-01` and `P-02`), both carrying the reservation's id. The availability for E1's window shows 1. |
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
