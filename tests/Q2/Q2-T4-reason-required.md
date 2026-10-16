# Q2-T4 — A release without a reason is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q2-T4 |
| Test Scenario | A missing, empty or whitespace-only reason is refused with a field error and nothing changes |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q2 from `tests/Q2/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), the actors TS, C1, ORG, VS and ATT, and line L1 (CHAIRS × 4 for E1, Confirmed, then reserved by TS through `POST /api/v1/equipment/request-lines/<L1>/reservation`, leaving 6 CHAIRS). |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/release` for L1 with the first body in Test Data.<br>2. Repeat with the second body, then the third.<br>3. As TS, send `GET /api/v1/equipment/request-lines/<L1>` and read its history.<br>4. As TS, send `GET /api/v1/equipment/types/<CHAIRS>/availability` for E1's window with requestedQuantity 1.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q2Cards.test.ts -t 'Q2-T4 '` (or the whole suite) and read the named `Q2-T4 ` result. |
| Test Data | `{}`, then `{"reason":""}`, then `{"reason":"   "}` |
| Expected Result | Each request returns HTTP 400 `VALIDATION_FAILED` with field `reason`. L1 is still `RESERVED`, its reservation is still `RESERVED` with null releasedBy, releasedAt and releaseReason, the availability shows availableQuantity 6, and the line's history has no new entry. |
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
