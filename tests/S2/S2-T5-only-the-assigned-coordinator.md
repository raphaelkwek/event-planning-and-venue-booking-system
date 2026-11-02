# S2-T5 — Only the assigned coordinator can decide

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T5 |
| Test Scenario | A coordinator not assigned to the event, the organiser, Technical Support and Venue Staff are refused; an unknown request is not found |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`). |
| Test Steps | 1. As C2, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`.<br>2. Repeat as ORG, as TS and as VS.<br>3. As C1, send the decision for a request id that does not exist.<br>4. Read CR1 and E1.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T5 '` (or the whole suite) and read the named `S2-T5 ` result. |
| Test Data | `{"decision":"APPROVE"}`; the unknown id is a well-formed UUID that matches no request. |
| Expected Result | C2 gets HTTP 404 `CHANGE_REQUEST_NOT_FOUND`, "No change request with that id is on an event assigned to you.", and the unknown id gets the same code and message. ORG, TS and VS each get HTTP 403 `ROLE_NOT_AUTHORISED` by role. CR1 is still `PENDING` and E1 is unchanged. |
| Created By | Raphael, via Claude |
| Date of Creation | 2026-10-18 |

> **Expected results are checked by the PR reviewer** against S2's acceptance criteria.

> **Revised for A4 (CR-05) on 2 Nov 2026.** Another coordinator gets the same 404 as for an unknown change request, rather than a 403.

## Execution record

| Item | Content |
|---|---|
| Actual Result | C2 got 404 CHANGE_REQUEST_NOT_FOUND "No change request with that id is on an event assigned to you.", the same as the unknown id. ORG, TS and VS got 403 ROLE_NOT_AUTHORISED. CR1 stayed PENDING and E1 was unchanged. |
| Status | Pass |
| Remarks | Commit: 6f59d76, automated, on a throwaway Postgres (EN-06) · Evidence: the named test result · Defect: — |
| Executed By | Shawmya, via Claude |
| Date of Execution | 2026-11-02 |
