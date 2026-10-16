# Q2-T1 — Technical Support releases a Reserved line with a reason

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T1 |
| Test Scenario | Releasing a Reserved line records who, when and why on the retained reservation, returns the line to Confirmed and restores the quantity to availability |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q2 from `tests/Q2/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), the actors TS, C1, ORG, VS and ATT, and line L1 (CHAIRS × 4 for E1, Confirmed, then reserved by TS through `POST /api/v1/equipment/request-lines/<L1>/reservation`, leaving 6 CHAIRS). |
| Test Steps | 1. Note the time, then send `POST /api/v1/equipment/request-lines/<id>/release` as TS for L1 with the body in Test Data, and note the time again.<br>2. As TS, send `GET /api/v1/equipment/request-lines/<L1>`.<br>3. As TS, send `GET /api/v1/equipment/types/<CHAIRS>/availability` for E1's window with requestedQuantity 1.<br>4. Read the `equipment.reservations` row of L1's reservation.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-T1 '` (or the whole suite) and read the named `Q2-T1 ` result. |
| Test Data | `{"reason":"Event moved to a smaller room"}` |
| Expected Result | HTTP 200. `reservation` has status `RELEASED`, releasedBy TS, releasedAt between the instants around the request, releaseReason `Event moved to a smaller room`, and the same id, requestedQuantity 4, reservedQuantity 4 and reservedBy TS as before. The `equipment.reservations` row still exists. `line.status` is `CONFIRMED` and statusChangedBy is TS. The availability for E1's window shows availableQuantity 10. |
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
