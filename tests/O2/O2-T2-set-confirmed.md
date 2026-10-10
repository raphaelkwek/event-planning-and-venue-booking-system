# O2-T2 — Technical Support confirms a line

## Specification

| Item | Content |
|---|---|
| Test Case ID | O2-T2 |
| Test Scenario | A status change to Confirmed records the staff member and timestamp, and reserves nothing |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O2 from `tests/O2/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT.<br>3. A CHAIRS line (quantity 40) with status `UNDER_REVIEW`.<br>4. Record the number of rows in `equipment.bulk_reservations` and `equipment.unit_reservations`. |
| Test Steps | 1. As TS, send `POST /api/v1/equipment/request-lines/<id>/status` with the body in Test Data.<br>2. Count the reservation rows again.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o2Cards.test.ts -t 'O2-T2 '` (or the whole suite) and read the named `O2-T2 ` result. |
| Test Data | `{"status":"CONFIRMED"}` |
| Expected Result | HTTP 200; status `CONFIRMED`; statusChangedBy TS with a timestamp around the request. The reservation row counts are unchanged (confirming is not reserving; Q1 reserves). |
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
