# Q1-T6 — A chosen partial reservation records the quantity actually reserved

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T6 |
| Test Scenario | A lower quantity with partial chosen reserves that quantity and records both the requested and the reserved quantity |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. An existing reservation of CHAIRS, quantity 7, for E1's window (made for another event); a CHAIRS line (quantity 5, Confirmed) for E1. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data.<br>2. As TS, send `GET /api/v1/equipment/request-lines/<id>` and read its history.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T6 '` (or the whole suite) and read the named `Q1-T6 ` result. |
| Test Data | `{"quantity":3,"partial":true}` |
| Expected Result | HTTP 201; requestedQuantity 5 and reservedQuantity 3. The line status is `RESERVED`. The history entry's `details` holds both quantities. |
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
