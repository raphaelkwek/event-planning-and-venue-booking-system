# Q1-T5 — One more than available is refused and nothing is stored

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T5 |
| Test Scenario | A request above the available quantity is refused naming the shortfall, creates no reservation and changes no quantity |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. An existing reservation of CHAIRS, quantity 7, for E1's window (made for another event); a CHAIRS line (quantity 4, Confirmed) for E1; the outbox is empty for this line. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data.<br>2. Read `equipment.reservations` for the line, the line's row and history, and `equipment.outbox` for the line.<br>3. As TS, send `GET /api/v1/equipment/types/<CHAIRS>/availability` for E1's window with requestedQuantity 1.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T5 '` (or the whole suite) and read the named `Q1-T5 ` result. |
| Test Data | `{}` |
| Expected Result | HTTP 409 `INSUFFICIENT_EQUIPMENT`; the message names 4 requested, 3 available and 1 short, and `details` is `{available: 3, shortfall: 1}`. There is no reservation row for the line. The CHAIRS availability is still 3. The line is still `CONFIRMED` with no new history entry, and there is no outbox row. |
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
