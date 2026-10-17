# S2-T3 — A rejection without a reason is refused and nothing changes

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T3 |
| Test Scenario | Rejecting with no reason, an empty reason or a blank reason leaves the request Pending, records no decision time and changes no event field |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`). |
| Test Steps | 1. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"REJECT"}`.<br>2. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"REJECT","reason":""}`.<br>3. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"REJECT","reason":"   "}`.<br>4. After each, read CR1 and send `GET /api/v1/events/<E1>`.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T3 '` (or the whole suite) and read the named `S2-T3 ` result. |
| Test Data | The three bodies in the steps: no `reason`, `""` and `"   "` (three spaces). |
| Expected Result | Each of the three returns HTTP 400 `VALIDATION_FAILED` with the error on `reason`. After each, CR1 is still `PENDING` with null `decidedBy`, `decidedAt` and `rejectionReason`, and E1 is unchanged (D 14:00, 150, same version, no new history entry). |
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
