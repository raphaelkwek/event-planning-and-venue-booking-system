# S2-T10 — A details edit based on the version before an approval is refused

## Specification

| Item | Content |
|---|---|
| Test Case ID | S2-T10 |
| Test Scenario | Approval bumps the event's version, so G1's edit carrying the old version in If-Match is refused |
| Pre-conditions | 1. Clean throwaway Postgres with every migration applied (including `change/0001` to `change/0003`), using the isolated setup in `tests/S2/README.md`. Authentication is stubbed: the signed-in user is whichever actor a step names. Real sign-in is outside this procedure.<br>2. Fixture FX-S2 from `tests/S2/README.md` is loaded: FX-S1 (event E1, Approved, owned by ORG, assigned coordinator C1, proposed `D 14:00`–`D 18:00` UTC, expected attendance 150) plus the actor C2 and the request CR1, ORG's Pending request on E1 (start `D 14:00` → `D 15:00`, attendance 150 → 180, reason `Keynote speaker arrives late`). |
| Test Steps | 1. As ORG, send `GET /api/v1/events/<E1>` and read the `ETag` response header (for example `"1"`) and the description.<br>2. As C1, send `POST /api/v1/change-requests/<CR1>/decision` with `{"decision":"APPROVE"}`.<br>3. As ORG, send `PATCH /api/v1/events/<E1>` with the body in Test Data and the header `If-Match` set to the ETag from step 1.<br>4. As ORG, send `GET /api/v1/events/<E1>` and compare the description.<br>5. Run `npm test -w @connectsphere/planning-core -- tests/change/api/s2Cards.test.ts -t 'S2-T10 '` (or the whole suite) and read the named `S2-T10 ` result. |
| Test Data | `{"description":"Updated description after the keynote moved"}` |
| Expected Result | The PATCH returns HTTP 412 `EVENT_VERSION_MISMATCH`. The event's description is the same as in step 1; the only changes since are the approval's. |
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
