# S2-T5 — Only the assigned coordinator can decide

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T5 |
| Test Scenario | A coordinator not assigned to the event, the organiser, Technical Support and Venue Staff are refused; an unknown request is not found |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`). |
| Test Steps | 1. As C2, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`.<br>2. Repeat as ORG, as TS and as VS.<br>3. As C1, send the decision for a request id that does not exist.<br>4. Read CR1 and E1.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T5 '` (or the whole suite) and read the named `S2-T5 ` result. |
| Test Data | `{"decision":"APPROVE"}`; the unknown id is a well-formed UUID that matches no request. |
| Expected Result | C2, ORG, TS and VS each get HTTP 403 `ROLE_NOT_AUTHORISED` (C2 because they are not assigned to E1; the others by role). The unknown id gets HTTP 404 `CHANGE_REQUEST_NOT_FOUND`. CR1 is still `PENDING` and E1 is unchanged. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

## Execution record

| Item | Content |
|---|---|
| Actual Result | |
| Status | Not Executed |
| Remarks | Waits for the S2 implementation and migrations change/0002 and change/0003 (CI runs them on the throwaway Postgres). Commit: · Evidence: · Defect: — |
| Executed By | |
| Date of Execution | |
