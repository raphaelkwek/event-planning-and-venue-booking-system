# Q2-T5 — Releasing twice changes nothing the second time

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T5 |
| Test Scenario | A second release of the same line is refused and writes no second release timestamp and returns no further quantity |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q2 from `tests/Q2/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), the actors TS, C1, ORG, VS and ATT, and line L1 (CHAIRS × 4 for E1, Confirmed, then reserved by TS through `POST /api/v1/equipment/request-lines/<L1>/reservation`, leaving 6 CHAIRS).<br>3. L1 has been released once, as in Q2-T1; note the reservation's `released_at` and `release_reason`. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/release` for L1 with the body in Test Data.<br>2. Read the reservation's `released_at` and `release_reason` again.<br>3. As TS, send `GET /api/v1/equipment/types/<CHAIRS>/availability` for E1's window with requestedQuantity 1.<br>4. Read L1's history.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-T5 '` (or the whole suite) and read the named `Q2-T5 ` result. |
| Test Data | `{"reason":"Again"}` |
| Expected Result | HTTP 409 `LINE_NOT_RELEASABLE`, naming Confirmed. `released_at` and `release_reason` equal those of the first release. The availability shows availableQuantity 10. L1's history has one release entry. |
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
