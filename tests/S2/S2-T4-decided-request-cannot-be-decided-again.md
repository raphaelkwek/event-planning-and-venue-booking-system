# S2-T4 — A request that already carries a decision cannot be decided again

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T4 |
| Test Scenario | After an approval, and after a rejection, a further approve or reject is refused naming the decision, and the first decision stands |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`).<br>3. A fresh FX-S2 (a second E1 with its own CR1) is loaded for the second part of the card. |
| Test Steps | 1. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`, then send it again.<br>2. On the fresh FX-S2, as C1, send the decision with `{"decision":"REJECT","reason":"No larger hall"}`, then send `{"decision":"APPROVE"}`.<br>3. After each refusal, read CR1 and the event.<br>4. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T4 '` (or the whole suite) and read the named `S2-T4 ` result. |
| Test Data | As in the steps. |
| Expected Result | Each second call returns HTTP 409 `CHANGE_REQUEST_ALREADY_DECIDED`. The message names Approved (first part) or Rejected (second part) and when, and `details` is `{status, decidedAt}` with the first decision's values. The first decision and the event are unchanged by the refused call: after the approval E1 still shows `D 15:00` and 180 with the version bumped once; after the rejection E1 still shows `D 14:00` and 150. |
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
