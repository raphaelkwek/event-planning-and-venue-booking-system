# O2-T1 — Technical Support sets a line Under Review

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T1 |
| Test Scenario | A status change to Under Review records the acting staff member and timestamp |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40, Submitted) for E1. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/status` with the body in Test Data.<br>2. As TS, send `GET /api/v1/equipment/request-lines/<id>`.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T1 '` (or the whole suite) and read the named `O2-T1 ` result. |
| Test Data | `{"status":"UNDER_REVIEW"}` |
| Expected Result | HTTP 200; status `UNDER_REVIEW`; statusChangedBy is TS and statusChangedAt is between the instants around the request. The history has a `STATUS_CHANGED` entry from `SUBMITTED` to `UNDER_REVIEW` for TS. |
| Created By | Joash, via Claude |
| Date of Creation | 2026-10-10 |

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | UI walk-through in Chrome pending at the sprint review |
| Executed By | |
| Date of Execution | |
