# O1-T1 — A coordinator records a line and the times default from the event

## Specification

| Item | Content |
|---|---|
| Test Case ID | O1-T1 |
| Test Scenario | The assigned coordinator saves one line with no times; it is Submitted, takes the event's times, and records who saved it and when |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied, using the isolated setup in `tests/O1/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-O1 from `tests/O1/README.md` is loaded: event E1 (Approved, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC), equipment types CHAIRS and PROJECTORS, and the actors C1, C2, ORG, TS, VS and ATT. |
| Test Steps | 1. As C1, send `POST /api/v1/equipment/request-lines` with the body in Test Data.<br>2. Record the response, then send `GET /api/v1/equipment/request-lines/<id>` as C1 for the new line.<br>3. Run `npm test -w @connectsphere/planning-core -- tests/equipment/api/o1Cards.test.ts -t 'O1-T1 '` (or the whole suite) and read the named `O1-T1 ` result. |
| Test Data | `{"eventId":"<E1>","lines":[{"equipmentTypeId":"<CHAIRS>","quantity":40,"notes":"Set out in rows of 10"}]}` (no requiredFrom or requiredTo). |
| Expected Result | HTTP 201 with one line: equipment type CHAIRS (name shown), quantity 40, notes `Set out in rows of 10`, status `SUBMITTED`, requiredFrom `D 14:00` and requiredTo `D 18:00` UTC (E1's proposed start and end), requestedBy C1, and requestedAt between the instants just before and just after the request. The GET returns the same line. |
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
