# O1-T22 — Other roles cannot write lines

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T22 |
| Test Scenario | The organiser, Technical Support, Venue Staff and attendee are refused every line write and nothing is stored |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT. |
| Test Steps | 1. For each of ORG, TS, VS and ATT in turn, send `POST /api/v1/equipment/request-lines` with the body of O1-T1.<br>2. Count the lines for E1.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T22 '` (or the whole suite) and read the named `O1-T22 ` result. |
| Test Data | The body of O1-T1. |
| Expected Result | Every request returns HTTP 403 `ROLE_NOT_AUTHORISED`. No line exists for E1. |
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
