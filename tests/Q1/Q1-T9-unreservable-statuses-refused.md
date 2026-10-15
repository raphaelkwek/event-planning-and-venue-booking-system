# Q1-T9 — Lines that are not Confirmed or Substituted cannot be reserved

## Specification

| Item | Content |
|---|---|
| Test Case ID | Q1-T9 |
| Test Scenario | Reserving a line in any other status is refused naming that status and stores nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/Q1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-Q1 from `tests/Q1/README.md` is loaded: event E1 (Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS (bulk, total 10) and PROJECTORS (serialized, units `P-01`, `P-02`, `P-03`), and the actors TS, C1, ORG, VS and ATT.<br>3. Five CHAIRS lines (quantity 4) for E1, with status Submitted, Under Review, Unavailable, Reserved and Removed respectively. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/reservation` with the body in Test Data, for each line.<br>2. Read `equipment.reservations` for the five lines and the five rows.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/q1Cards.test.ts -t 'Q1-T9 '` (or the whole suite) and read the named `Q1-T9 ` result. |
| Test Data | `{}` for each line |
| Expected Result | Each request returns HTTP 409 `LINE_NOT_RESERVABLE`; the message names the status label (Submitted, Under Review, Unavailable, Reserved, Removed) and `details.status` holds its code. Nothing is stored and no line changes. |
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
